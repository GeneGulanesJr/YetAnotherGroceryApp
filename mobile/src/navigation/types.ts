export type RootStackParamList = {
  MainTabs: undefined;
  Auth: undefined;
  Scanner: undefined;
  ProductResolve: { barcode: string; format?: string };
  ManualProduct: { barcode?: string };
  PriceCapture: {
    productId: string;
    barcode?: string;
    prefillAmount?: string;
    ocrRawText?: string;
    ocrConfidence?: number;
    sourceImageId?: string;
  };
  PriceTag: { productId: string };
  ReceiptCapture: { tripId?: string };
};
