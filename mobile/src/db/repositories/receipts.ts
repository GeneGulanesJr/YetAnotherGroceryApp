import { and, desc, eq, isNull } from "drizzle-orm";
import {
  products,
  purchases,
  receiptLines,
  receipts,
  type Receipt,
  type ReceiptLine,
} from "../schema";
import { now } from "../context";
import { trackInsert, trackUpdate } from "../outbox";
import { normalizeDescription, stripAmountAndQuantity } from "../../capture/receiptParse";
import { findProductIdByAlias, learnAlias } from "./receipt-aliases";
import type { Db } from "../types";

export interface ConfirmedReceiptLine {
  lineType: ReceiptLine["lineType"];
  descriptionRaw: string | null;
  descriptionCorrected: string | null;
  quantity: number | null;
  unitPriceMinor: number | null;
  lineTotalMinor: number | null;
}

export interface CreateReceiptInput {
  tripId: string | null;
  storeId: string | null;
  currency: string;
  sourceImageId?: string | null;
  rawOcrText?: string | null;
  lines: readonly ConfirmedReceiptLine[];
}

/**
 * Saves a confirmed receipt and its lines in one transaction (spec: receipts
 * are multi-record writes). Product lines are matched against the trip's
 * purchases by normalized-name containment; matches back-fill the purchase
 * with the receipt price and a discrepancy value.
 */
export function createReceiptWithLines(db: Db, input: CreateReceiptInput): Receipt {
  return db.transaction((tx) => {
    const productLines = input.lines.filter((line) => line.lineType === "product");
    const subtotal = productLines.reduce((sum, line) => sum + (line.lineTotalMinor ?? 0), 0);
    const totalLine = input.lines.find((line) => line.lineType === "total");
    const tax = input.lines
      .filter((line) => line.lineType === "tax")
      .reduce((sum, line) => sum + (line.lineTotalMinor ?? 0), 0);
    const discount = input.lines
      .filter((line) => line.lineType === "discount")
      .reduce((sum, line) => sum + (line.lineTotalMinor ?? 0), 0);

    const receipt = trackInsert(tx, receipts, {
      storeId: input.storeId,
      tripId: input.tripId,
      currency: input.currency,
      subtotalMinor: subtotal,
      totalMinor: totalLine?.lineTotalMinor ?? subtotal,
      taxMinor: tax,
      discountMinor: discount,
      savingsMinor: discount,
      overchargeMinor: null,
      capturedAt: now(),
      sourceImageId: input.sourceImageId ?? null,
      rawOcrText: input.rawOcrText ?? null,
      verifiedAt: now(),
    });

    let overcharge = 0;
    let anyMatch = false;

    input.lines.forEach((line, index) => {
      let productId: string | null = null;
      let matchedAlias: string | null = null;

      if (line.lineType === "product" && input.tripId !== null) {
        const description = stripAmountAndQuantity(
          line.descriptionCorrected ?? line.descriptionRaw ?? "",
        );
        const match = matchTripPurchase(tx, input.tripId, line);
        if (match !== null) {
          productId = match.productId;
          matchedAlias = description;
          // Learn: confirmed receipt description -> product at this store.
          learnAlias(tx, {
            storeId: input.storeId,
            alias: normalizeDescription(description),
            productId: match.productId,
          });
        } else {
          // Fall back to previously learned aliases for this store.
          const aliasProductId = findProductIdByAlias(
            tx,
            normalizeDescription(description),
            input.storeId,
          );
          if (
            aliasProductId !== null &&
            tripHasUnmatchedPurchase(tx, input.tripId, aliasProductId)
          ) {
            productId = aliasProductId;
            matchedAlias = description;
          }
        }
      }

      const savedLine = trackInsert(tx, receiptLines, {
        receiptId: receipt.id,
        productId,
        lineNumber: index + 1,
        lineType: line.lineType,
        descriptionRaw: line.descriptionRaw,
        descriptionCorrected: line.descriptionCorrected,
        quantity: line.quantity,
        rawUnitPriceMinor: line.unitPriceMinor,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.lineTotalMinor,
        confidence: null,
        matchedAlias,
      });

      if (productId !== null && line.unitPriceMinor !== null && input.tripId !== null) {
        const purchase = tx
          .select()
          .from(purchases)
          .where(
            and(
              eq(purchases.tripId, input.tripId),
              eq(purchases.productId, productId),
              isNull(purchases.receiptId),
              isNull(purchases.deletedAt),
            ),
          )
          .limit(1)
          .get();
        if (purchase !== undefined) {
          const discrepancy = line.unitPriceMinor - purchase.shelfPriceMinor;
          trackUpdate(tx, purchases, purchase.id, {
            receiptId: receipt.id,
            receiptLineId: savedLine.id,
            receiptUnitPriceMinor: line.unitPriceMinor,
            receiptLineTotalMinor: line.lineTotalMinor,
            priceDiscrepancyMinor: discrepancy,
          });
          if (discrepancy > 0) {
            overcharge += discrepancy * purchase.quantity;
          }
          anyMatch = true;
        }
      }
    });

    if (anyMatch) {
      trackUpdate(tx, receipts, receipt.id, { overchargeMinor: overcharge });
    }

    return {
      ...receipt,
      overchargeMinor: anyMatch ? overcharge : receipt.overchargeMinor,
    };
  });
}

/** v1 matcher: normalized containment against the trip's scanned products. */
function matchTripPurchase(
  db: Parameters<Parameters<Db["transaction"]>[0]>[0],
  tripId: string,
  line: ConfirmedReceiptLine,
): { productId: string } | null {
  const description = normalizeDescription(
    line.descriptionCorrected ?? line.descriptionRaw ?? "",
  );
  if (description === "") {
    return null;
  }

  const tripPurchases = db
    .select({ productId: purchases.productId, productName: products.name })
    .from(purchases)
    .innerJoin(products, eq(products.id, purchases.productId))
    .where(
      and(
        eq(purchases.tripId, tripId),
        isNull(purchases.deletedAt),
        isNull(purchases.receiptId),
      ),
    )
    .all();

  const matches = tripPurchases.filter(({ productName }) => {
    const candidate = normalizeDescription(productName);
    return candidate !== "" && (candidate.includes(description) || description.includes(candidate));
  });

  return matches.length === 1 ? matches[0] : null;
}

/** Alias matches may only attach to products actually bought (unmatched) on the trip. */
function tripHasUnmatchedPurchase(
  db: Parameters<Parameters<Db["transaction"]>[0]>[0],
  tripId: string,
  productId: string,
): boolean {
  return (
    db
      .select({ id: purchases.id })
      .from(purchases)
      .where(
        and(
          eq(purchases.tripId, tripId),
          eq(purchases.productId, productId),
          isNull(purchases.deletedAt),
          isNull(purchases.receiptId),
        ),
      )
      .limit(1)
      .get() !== undefined
  );
}

export interface ReceiptSummaryLine extends Receipt {
  lineCount: number;
}

export function listReceipts(db: Db, limit = 50): ReceiptSummaryLine[] {
  const rows = db
    .select()
    .from(receipts)
    .where(isNull(receipts.deletedAt))
    .orderBy(desc(receipts.capturedAt))
    .limit(limit)
    .all();
  return rows.map((receipt) => ({
    ...receipt,
    lineCount: db
      .select({ id: receiptLines.id })
      .from(receiptLines)
      .where(and(eq(receiptLines.receiptId, receipt.id), isNull(receiptLines.deletedAt)))
      .all().length,
  }));
}

export function getReceiptWithLines(
  db: Db,
  receiptId: string,
): { receipt: Receipt; lines: ReceiptLine[] } | null {
  const receipt = db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, receiptId), isNull(receipts.deletedAt)))
    .get();
  if (receipt === undefined) {
    return null;
  }
  const lines = db
    .select()
    .from(receiptLines)
    .where(and(eq(receiptLines.receiptId, receiptId), isNull(receiptLines.deletedAt)))
    .orderBy(receiptLines.lineNumber)
    .all();
  return { receipt, lines };
}
