import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";

const BUCKET = "payment-assets";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function assertAllowedPaymentImage(file: File): void {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new AppError("Proof image must be JPEG, PNG, WebP, or GIF", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }
  if (file.size > MAX_BYTES) {
    throw new AppError("Proof image must be 5 MB or smaller", {
      code: "VALIDATION_ERROR",
      status: 400,
      expose: true,
    });
  }
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function uploadPaymentProofImage(
  orderId: string,
  paymentId: string,
  file: File,
): Promise<string> {
  assertAllowedPaymentImage(file);
  const ext = extensionForMime(file.type);
  const path = `proofs/${orderId}/${paymentId}.${ext}`;
  return uploadToBucket(path, file);
}

export async function uploadShamCashQrImage(file: File): Promise<string> {
  assertAllowedPaymentImage(file);
  const ext = extensionForMime(file.type);
  const path = `settings/sham-cash-qr.${ext}`;
  return uploadToBucket(path, file);
}

async function uploadToBucket(path: string, file: File): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new AppError("Failed to upload image", { code: "EXTERNAL_SERVICE", cause: error });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
