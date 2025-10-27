import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Minus, Plus, Trash2, CreditCard, Smartphone, Banknote } from "lucide-react";

interface Product {
  id: string;
  name: string;
  selling_price: number;
  stock_quantity: number;
  vat_rate: number;
}

interface CartItem extends Product {
  quantity: number;
  line_total: number;
}

const POS = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStoreAndProducts = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("id", user.id)
        .single();

      if (profile?.store_id) {
        setStoreId(profile.store_id);

        const { data: productsData } = await supabase
          .from("products")
          .select("id, name, selling_price, stock_quantity, vat_rate")
          .eq("store_id", profile.store_id)
          .eq("active", true)
          .order("name");

        if (productsData) {
          setProducts(productsData);
        }
      }
    };

    fetchStoreAndProducts();
  }, [user]);

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        toast.error("Not enough stock available");
        return;
      }
      updateQuantity(product.id, existingItem.quantity + 1);
    } else {
      const newItem: CartItem = {
        ...product,
        quantity: 1,
        line_total: Number(product.selling_price),
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const quantity = Math.max(0, newQuantity);
        return {
          ...item,
          quantity,
          line_total: Number(item.selling_price) * quantity,
        };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
    const vatAmount = cart.reduce((sum, item) => {
      const itemVat = (item.line_total * item.vat_rate) / (100 + item.vat_rate);
      return sum + itemVat;
    }, 0);
    return { subtotal, vatAmount, total: subtotal };
  };

  const handleCheckout = async (paymentMethod: 'mpesa' | 'cash' | 'card') => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!storeId) {
      toast.error("Store not configured");
      return;
    }

    setLoading(true);
    try {
      const { subtotal, vatAmount, total } = calculateTotals();
      const receiptNumber = `RCP-${Date.now()}`;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          receipt_number: receiptNumber,
          store_id: storeId,
          cashier_id: user!.id,
          subtotal,
          vat_amount: vatAmount,
          total_amount: total,
          status: "completed",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.selling_price,
        vat_rate: item.vat_rate,
        line_total: item.line_total,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Create payment
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          sale_id: sale.id,
          payment_method: paymentMethod,
          amount: total,
        });

      if (paymentError) throw paymentError;

      // Update stock quantities
      for (const item of cart) {
        await supabase
          .from("products")
          .update({ stock_quantity: item.stock_quantity - item.quantity })
          .eq("id", item.id);
      }

      toast.success(`Sale completed! Receipt: ${receiptNumber}`);
      setCart([]);
      
      // Refresh products
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, selling_price, stock_quantity, vat_rate")
        .eq("store_id", storeId)
        .eq("active", true)
        .order("name");

      if (productsData) {
        setProducts(productsData);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to complete sale");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { subtotal, vatAmount, total } = calculateTotals();

  return (
    <div className="h-[calc(100vh-4rem)] grid grid-cols-2 gap-6">
      {/* Products Section */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
                  disabled={product.stock_quantity === 0}
                >
                  <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                  <p className="text-lg font-bold text-primary">
                    KES {Number(product.selling_price).toLocaleString()}
                  </p>
                  <Badge variant={product.stock_quantity > 0 ? "secondary" : "destructive"} className="mt-2">
                    Stock: {product.stock_quantity}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Cart Section */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Current Sale</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 mb-4">
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-3 rounded-lg bg-accent">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      KES {Number(item.selling_price).toLocaleString()} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-right w-24">
                    <p className="font-bold">
                      KES {item.line_total.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">KES {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT (16%)</span>
              <span className="font-medium">KES {vatAmount.toLocaleString()}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-success">KES {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => handleCheckout('mpesa')}
              disabled={loading || cart.length === 0}
              className="bg-success hover:bg-success/90"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              M-Pesa
            </Button>
            <Button
              onClick={() => handleCheckout('cash')}
              disabled={loading || cart.length === 0}
              variant="secondary"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Cash
            </Button>
            <Button
              onClick={() => handleCheckout('card')}
              disabled={loading || cart.length === 0}
              variant="outline"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Card
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default POS;