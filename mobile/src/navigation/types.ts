export type RootStackParamList = {
  MainTabs: undefined;
  Scanner: undefined;
  ProductResolve: { barcode: string; format?: string };
  ManualProduct: { barcode?: string };
  PriceCapture: { productId: string; barcode?: string };
};
