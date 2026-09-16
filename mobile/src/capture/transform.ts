/**
 * Coordinate transformation between OCR bounding boxes (intrinsic image
 * pixels) and rendered view coordinates, per tech.mobile.md ("OCR overlay
 * alignment"): overlays must survive image scaling, and the math must be
 * tested independently of the UI.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Frame {
  width: number;
  height: number;
}

export interface Transform {
  /** Image px -> view px multiplier. */
  scale: number;
  /** View-space offset of the image origin. */
  offsetX: number;
  offsetY: number;
}

/** Letterboxed fit: whole image visible, centered. */
export function containTransform(image: Frame, container: Frame): Transform {
  if (image.width <= 0 || image.height <= 0) {
    return { scale: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(container.width / image.width, container.height / image.height);
  return centerTransform(scale, image, container);
}

/** Cropped fit: image fills the container, centered overflow. */
export function coverTransform(image: Frame, container: Frame): Transform {
  if (image.width <= 0 || image.height <= 0) {
    return { scale: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.max(container.width / image.width, container.height / image.height);
  return centerTransform(scale, image, container);
}

function centerTransform(scale: number, image: Frame, container: Frame): Transform {
  return {
    scale,
    offsetX: (container.width - image.width * scale) / 2,
    offsetY: (container.height - image.height * scale) / 2,
  };
}

/** Projects an image-space box into view coordinates. */
export function projectBox(box: Box, transform: Transform): Box {
  return {
    x: box.x * transform.scale + transform.offsetX,
    y: box.y * transform.scale + transform.offsetY,
    width: box.width * transform.scale,
    height: box.height * transform.scale,
  };
}

/** Maps a view-space point back to image pixels (e.g. a tap). */
export function unprojectPoint(
  point: { x: number; y: number },
  transform: Transform,
): { x: number; y: number } {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

/** True when an image-space box contains the image-space point. */
export function boxContains(box: Box, point: { x: number; y: number }): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}
