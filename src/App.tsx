import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/pos" element={<Layout><POS /></Layout>} />
            <Route path="/inventory" element={<Layout><div className="text-center py-12"><h2 className="text-2xl font-bold">Inventory</h2><p className="text-muted-foreground mt-2">Coming soon...</p></div></Layout>} />
            <Route path="/reports" element={<Layout><div className="text-center py-12"><h2 className="text-2xl font-bold">Reports</h2><p className="text-muted-foreground mt-2">Coming soon...</p></div></Layout>} />
            <Route path="/settings" element={<Layout><div className="text-center py-12"><h2 className="text-2xl font-bold">Settings</h2><p className="text-muted-foreground mt-2">Coming soon...</p></div></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
