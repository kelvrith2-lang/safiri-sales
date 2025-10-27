import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Package, TrendingUp, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    todaySales: 0,
    todayTransactions: 0,
    lowStock: 0,
    totalProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Get user's store
        const { data: profile } = await supabase
          .from("profiles")
          .select("store_id")
          .eq("id", user.id)
          .single();

        if (!profile?.store_id) {
          setLoading(false);
          return;
        }

        // Get today's sales
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: todaySales } = await supabase
          .from("sales")
          .select("total_amount")
          .eq("store_id", profile.store_id)
          .eq("status", "completed")
          .gte("created_at", startOfDay.toISOString());

        const totalSales = todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0;
        const transactionCount = todaySales?.length || 0;

        // Get inventory stats
        const { data: products } = await supabase
          .from("products")
          .select("stock_quantity, reorder_level")
          .eq("store_id", profile.store_id)
          .eq("active", true);

        const lowStockCount = products?.filter(p => p.stock_quantity <= p.reorder_level).length || 0;
        const totalProductCount = products?.length || 0;

        setStats({
          todaySales: totalSales,
          todayTransactions: transactionCount,
          lowStock: lowStockCount,
          totalProducts: totalProductCount,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const statCards = [
    {
      title: "Today's Sales",
      value: `KES ${stats.todaySales.toLocaleString()}`,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Transactions",
      value: stats.todayTransactions,
      icon: ShoppingCart,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStock,
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Total Products",
      value: stats.totalProducts,
      icon: TrendingUp,
      color: "text-accent-foreground",
      bgColor: "bg-accent",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's your store overview.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/pos"
            className="p-6 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-center"
          >
            <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">New Sale</h3>
            <p className="text-sm text-muted-foreground mt-1">Process a transaction</p>
          </a>
          <a
            href="/inventory"
            className="p-6 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-center"
          >
            <Package className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Manage Inventory</h3>
            <p className="text-sm text-muted-foreground mt-1">Add or update products</p>
          </a>
          <a
            href="/reports"
            className="p-6 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-center"
          >
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">View Reports</h3>
            <p className="text-sm text-muted-foreground mt-1">Check sales analytics</p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;