-- Create enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier');
CREATE TYPE public.payment_method AS ENUM ('mpesa', 'cash', 'card');
CREATE TYPE public.sale_status AS ENUM ('completed', 'voided', 'pending');

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  store_id UUID REFERENCES public.stores(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  store_id UUID REFERENCES public.stores(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  category_id UUID REFERENCES public.categories(id),
  store_id UUID REFERENCES public.stores(id) NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  vat_rate DECIMAL(5,2) DEFAULT 16.00,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  store_id UUID REFERENCES public.stores(id),
  total_purchases DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  store_id UUID REFERENCES public.stores(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  cashier_id UUID REFERENCES public.profiles(id) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status sale_status DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sale_items table
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  payment_method payment_method NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for stores (admins can manage all, others can view their store)
CREATE POLICY "Admins can manage all stores"
  ON public.stores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their store"
  ON public.stores FOR SELECT
  USING (
    id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for products (store-specific)
CREATE POLICY "Users can view store products"
  ON public.products FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers and admins can manage products"
  ON public.products FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for categories
CREATE POLICY "Users can view store categories"
  ON public.categories FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers and admins can manage categories"
  ON public.categories FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for customers
CREATE POLICY "Users can view store customers"
  ON public.customers FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "All authenticated users can manage customers"
  ON public.customers FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for sales
CREATE POLICY "Users can view store sales"
  ON public.sales FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "All authenticated users can create sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins can void sales"
  ON public.sales FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- RLS Policies for sale_items
CREATE POLICY "Users can view sale items"
  ON public.sale_items FOR SELECT
  USING (
    sale_id IN (
      SELECT id FROM public.sales 
      WHERE store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "All authenticated users can create sale items"
  ON public.sale_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for payments
CREATE POLICY "Users can view payments"
  ON public.payments FOR SELECT
  USING (
    sale_id IN (
      SELECT id FROM public.sales 
      WHERE store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "All authenticated users can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_products_store_id ON public.products(store_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_sales_store_id ON public.sales(store_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX idx_customers_store_id ON public.customers(store_id);