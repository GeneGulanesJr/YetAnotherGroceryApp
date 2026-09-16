import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trips } from "../schema";
import { createProduct } from "../repositories/products";
import { addProductToTrip, getActiveTrip, getTripPurchases, startTrip } from "../repositories/trips";
import { createFileTestDb } from "../test-helpers";

/**
 * Spec requirement: an active trip must survive application termination.
 * Simulated by closing the SQLite handle and reopening the same file.
 */
describe("persistence across app restarts", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(mkdtempSync(join(tmpdir(), "yaga-test-")), "yaga.db");
  });

  it("recovers the active trip and its purchases after reopening", () => {
    const first = createFileTestDb(dbPath);
    const trip = startTrip(first, { currency: "PHP" });
    const milk = createProduct(first, { name: "Milk 1L" });
    addProductToTrip(first, {
      tripId: trip.id,
      productId: milk.id,
      currency: "PHP",
      shelfPriceMinor: 12_500,
    });

    // "App kill": brand-new handle on the same file, migrations re-run.
    const reopened = createFileTestDb(dbPath);
    const recovered = getActiveTrip(reopened);
    expect(recovered?.id).toBe(trip.id);

    const lines = getTripPurchases(reopened, recovered!.id);
    expect(lines).toHaveLength(1);
    expect(lines[0].productName).toBe("Milk 1L");
    expect(lines[0].shelfPriceMinor).toBe(12_500);
  });

  it("does not duplicate seeded data when reopened twice", () => {
    const first = createFileTestDb(dbPath);
    startTrip(first, { currency: "PHP" });
    createFileTestDb(dbPath);
    const again = createFileTestDb(dbPath);
    expect(getActiveTrip(again)?.status).toBe("active");
    expect(again.select().from(trips).all()).toHaveLength(1);
  });
});
