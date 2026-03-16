"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getProducerIdByToken(token: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("producer_links")
    .select("producer_id")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`producer_links取得失敗: ${error.message}`);
  }

  if (!data) {
    throw new Error("無効なURLです");
  }

  return data.producer_id as string;
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function upsertSubmission(params: {
  token: string;
  status: "draft" | "submitted";
  setSubmittedAt: boolean;
  formData: FormData;
}) {
  const { token, status, setSubmittedAt, formData } = params;

  const producerId = await getProducerIdByToken(token);
  const supabase = await createClient();

  const payload = {
    producer_id: producerId,
    product_name: getString(formData, "product_name"),
    spec: getString(formData, "spec"),
    quantity: getString(formData, "quantity"),
    price: getString(formData, "price"),
    shipping_month_1: getString(formData, "shipping_month_1"),
    shipping_month_2: getString(formData, "shipping_month_2"),
    notes: getString(formData, "notes"),
    status,
    updated_at: new Date().toISOString(),
    submitted_at: setSubmittedAt ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("submissions").upsert(payload, {
    onConflict: "producer_id",
  });

  if (error) {
    throw new Error(`submissions保存失敗: ${error.message}`);
  }

  revalidatePath(`/entry/${token}`);
  revalidatePath("/admin");
}

export async function saveDraftAction(formData: FormData) {
  const token = getString(formData, "token");

  if (!token) {
    throw new Error("token がありません");
  }

  await upsertSubmission({
    token,
    status: "draft",
    setSubmittedAt: false,
    formData,
  });
}

export async function submitProposalAction(formData: FormData) {
  const token = getString(formData, "token");

  if (!token) {
    throw new Error("token がありません");
  }

  const productName = getString(formData, "product_name");

  if (!productName) {
    throw new Error("商品名は必須です");
  }

  await upsertSubmission({
    token,
    status: "submitted",
    setSubmittedAt: true,
    formData,
  });
}