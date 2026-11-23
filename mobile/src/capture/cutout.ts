import type { CutoutSubject } from "../../modules/item-cutout";
import { parsePriceCandidates, type OcrLine } from "./priceParse";
import type { Box, Frame } from "./transform";

/** Share of the frame a product must cover; below is a speck, above is the whole shelf. */
const MIN_FRAME_SHARE = 0.04;
const MAX_FRAME_SHARE = 0.9;
/** A subject this covered by its price, or by text around a price, is the tag. */
const TAG_PRICE_SHARE = 0.12;
const TAG_TEXT_SHARE = 0.35;
/** A runner-up this close means several products and no clear main one. */
const TIE_SHARE = 0.85;
const EDGE_PX = 2;

function overlapArea(a: Box, b: Box): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

const coveredShare = (subject: Box, boxes: readonly Box[]) =>
  boxes.reduce((sum, box) => sum + overlapArea(subject, box), 0) / (subject.width * subject.height);

const touchesAllEdges = (s: Box, image: Frame) =>
  s.x <= EDGE_PX &&
  s.y <= EDGE_PX &&
  s.x + s.width >= image.width - EDGE_PX &&
  s.y + s.height >= image.height - EDGE_PX;

/**
 * The main product among segmented subjects, or null when unsure (the caller
 * then keeps the full photo). Snap photos include the price tag on purpose,
 * so OCR boxes, which share the subjects' image space, identify and reject it.
 */
export function pickSubject(
  subjects: readonly CutoutSubject[],
  image: Frame,
  lines: readonly OcrLine[],
): CutoutSubject | null {
  const frame = image.width * image.height;
  if (frame <= 0) {
    return null;
  }
  const prices = parsePriceCandidates(lines).flatMap((candidate) => candidate.bbox ?? []);
  const texts = lines.flatMap((line) => line.bbox ?? []);
  const isTag = (subject: CutoutSubject) => {
    const held = prices.filter((box) => overlapArea(subject, box) >= (box.width * box.height) / 2);
    return held.length > 0 && (coveredShare(subject, held) >= TAG_PRICE_SHARE || coveredShare(subject, texts) >= TAG_TEXT_SHARE);
  };

  const [best, next] = subjects
    .filter(
      (subject) =>
        subject.width > 0 &&
        subject.height > 0 &&
        subject.pixels >= MIN_FRAME_SHARE * frame &&
        subject.pixels <= MAX_FRAME_SHARE * frame &&
        !touchesAllEdges(subject, image) &&
        !isTag(subject),
    )
    .sort((a, b) => b.pixels - a.pixels);
  if (best === undefined || (next !== undefined && next.pixels >= TIE_SHARE * best.pixels)) {
    return null;
  }
  return best;
}
