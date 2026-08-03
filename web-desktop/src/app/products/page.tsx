import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Product Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Purchase history, price trends, and unit-price intelligence per product.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Product tables, price history charts, and best/average price summaries land here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
