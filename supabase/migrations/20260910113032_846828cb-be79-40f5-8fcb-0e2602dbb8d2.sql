CREATE TABLE public.payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL DEFAULT '03001234567',
  account_name TEXT NOT NULL DEFAULT 'Account Holder',
  account_label TEXT NOT NULL DEFAULT 'JazzCash',
  amount NUMERIC NOT NULL DEFAULT 0,
  logo_url TEXT,
  whatsapp_link TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_settings TO anon, authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read payment settings" ON public.payment_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.payment_screenshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL DEFAULT '',
  user_phone TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.payment_screenshots TO anon, authenticated;
GRANT ALL ON public.payment_screenshots TO service_role;
ALTER TABLE public.payment_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit payment proof" ON public.payment_screenshots FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.admin_config (
  id INT PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_config_single_row CHECK (id = 1)
);
GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_config (id, password_hash) VALUES (1, 'f7298948225be27bf643ab6ac049c6bf953ab0d6a9513786a49692941142169b');
INSERT INTO public.payment_settings (phone_number, account_name, account_label, amount, whatsapp_link) VALUES ('03001234567', 'Account Holder', 'JazzCash', 1500, 'https://wa.me/923001234567');

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_settings;

CREATE POLICY "Anyone can upload payment screenshots" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'payment-screenshots');