import { supabase } from "@/integrations/supabase/client";

export type PaymentSettings = {
  phone_number: string;
  account_name: string;
  amount: number;
  logo_url: string | null;
  account_label: string;
  whatsapp_link: string;
};

export const fetchPaymentSettings = async (): Promise<PaymentSettings | null> => {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("phone_number,account_name,amount,logo_url,account_label,whatsapp_link")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, amount: Number(data.amount) } as PaymentSettings;
};
