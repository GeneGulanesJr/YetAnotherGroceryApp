/** A user-confirmed price plus its OCR provenance (tech.mobile.md OCR path). */
export interface CapturedPrice {
  prefillAmount?: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  sourceImageId?: string;
}

export type RootStackParamList = {
  MainTabs: undefined;
  Auth: undefined;
  Scanner: undefined;
  ProductResolve: { barcode: string; format?: string };
  SnapItem: undefined;
  ManualProduct: {
    barcode?: string;
    /** Price confirmed before the product existed (Snap item); passed on to PriceCapture. */
    price?: CapturedPrice;
    /** Item names read from the tag photo, best first; the first prefills the name. */
    nameSuggestions?: string[];
  };
  PriceCapture: { productId: string; barcode?: string } & CapturedPrice;
  PriceTag: { productId: string };
  ReceiptCapture: { tripId?: string };
};
