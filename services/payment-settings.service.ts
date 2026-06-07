import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import type { PublicShamCashPaymentSettings } from "@/types/api";

const SETTINGS_ROW_ID = "00000000-0000-0000-0000-000000000001";

const DEFAULT_INSTRUCTIONS =
  "Transfer the exact order amount to the Sham Cash account below, include your order reference in the payment note, then submit your transaction ID and payment screenshot.";

export type PlatformPaymentSettingsRow = {
  id: string;
  sham_cash_account_id: string;
  sham_cash_api_account_id: string;
  sham_cash_account_name: string;
  sham_cash_qr_image_url: string | null;
  payment_instructions: string;
  updated_at: string;
  updated_by: string | null;
};

export async function getPlatformPaymentSettings(): Promise<PlatformPaymentSettingsRow> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("platform_payment_settings")
    .select("*")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new AppError("Failed to load payment settings", { code: "DATABASE", cause: error });
  }

  if (data) return data as PlatformPaymentSettingsRow;

  return {
    id: SETTINGS_ROW_ID,
    sham_cash_account_id: "",
    sham_cash_api_account_id: "",
    sham_cash_account_name: "",
    sham_cash_qr_image_url: null,
    payment_instructions: DEFAULT_INSTRUCTIONS,
    updated_at: new Date().toISOString(),
    updated_by: null,
  };
}

export async function getPublicShamCashPaymentSettings(): Promise<PublicShamCashPaymentSettings> {
  const settings = await getPlatformPaymentSettings();
  return mapPublicSettings(settings);
}

export async function updatePlatformPaymentSettings(input: {
  shamCashAccountId: string;
  shamCashApiAccountId?: string;
  shamCashAccountName: string;
  paymentInstructions: string;
  shamCashQrImageUrl?: string | null;
  updatedBy: string;
}): Promise<PlatformPaymentSettingsRow> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("platform_payment_settings")
    .upsert({
      id: SETTINGS_ROW_ID,
      sham_cash_account_id: input.shamCashAccountId.trim(),
      sham_cash_api_account_id: input.shamCashApiAccountId?.trim() ?? "",
      sham_cash_account_name: input.shamCashAccountName.trim(),
      payment_instructions: input.paymentInstructions.trim() || DEFAULT_INSTRUCTIONS,
      sham_cash_qr_image_url: input.shamCashQrImageUrl ?? null,
      updated_at: new Date().toISOString(),
      updated_by: input.updatedBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("Failed to save payment settings", { code: "DATABASE", cause: error });
  }

  return data as PlatformPaymentSettingsRow;
}

function mapPublicSettings(row: PlatformPaymentSettingsRow): PublicShamCashPaymentSettings {
  return {
    accountId: row.sham_cash_account_id,
    accountName: row.sham_cash_account_name,
    qrImageUrl: row.sham_cash_qr_image_url,
    instructions: row.payment_instructions || DEFAULT_INSTRUCTIONS,
  };
}
