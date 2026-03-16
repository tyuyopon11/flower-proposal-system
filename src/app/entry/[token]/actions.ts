"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

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

  return Number(data.producer_id);
}

async function getCurrentPeriodId() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("submission_periods")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`submission_periods取得失敗: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("submission_periods に有効な期間データがありません");
  }

  return Number(data.id);
}

async function findOrCreateSubmission(params: {
  producerId: number;
  periodId: number;
  status: "draft" | "submitted";
}) {
  const { producerId, periodId, status } = params;
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("submissions")
    .select("id, submitted_at")
    .eq("producer_id", producerId)
    .eq("period_id", periodId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`submissions既存取得失敗: ${existingError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        status,
        last_saved_at: now,
        submitted_at:
          status === "submitted" ? now : existing.submitted_at ?? null,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`submissions更新失敗: ${updateError.message}`);
    }

    return Number(existing.id);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("submissions")
    .insert({
      producer_id: producerId,
      period_id: periodId,
      status,
      last_saved_at: now,
      submitted_at: status === "submitted" ? now : null,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`submissions新規作成失敗: ${insertError.message}`);
  }

  return Number(inserted.id);
}

async function replaceSubmissionItems(params: {
  submissionId: number;
  formData: FormData;
}) {
  const { submissionId, formData } = params;
  const supabase = await createClient();

  const productName = getString(formData, "product_name");
  const spec = getString(formData, "spec");
  const quantity = getString(formData, "quantity");
  const price = getString(formData, "price");
  const shippingMonth1 = getString(formData, "shipping_month_1");
  const shippingMonth2 = getString(formData, "shipping_month_2");
  const notes = getString(formData, "notes");

  const { error: deleteError } = await supabase
    .from("submission_items")
    .delete()
    .eq("submission_id", submissionId);

  if (deleteError) {
    throw new Error(`submission_items削除失敗: ${deleteError.message}`);
  }

  const hasAnyValue =
    productName ||
    spec ||
    quantity ||
    price ||
    shippingMonth1 ||
    shippingMonth2 ||
    notes;

  if (!hasAnyValue) {
    return;
  }

  const { error: insertError } = await supabase
    .from("submission_items")
    .insert({
      submission_id: submissionId,
      display_order: 1,
      product_name: productName || null,
      spec: spec || null,
      quantity: quantity || null,
      price: price || null,
      shipping_month_1: shippingMonth1 || null,
      shipping_month_2: shippingMonth2 || null,
      notes: notes || null,
    });

  if (insertError) {
    throw new Error(`submission_items保存失敗: ${insertError.message}`);
  }
}

async function saveEntry(params: {
  formData: FormData;
  status: "draft" | "submitted";
}) {
  const { formData, status } = params;

  const token = getString(formData, "token");
  if (!token) {
    throw new Error("token がありません");
  }

  if (status === "submitted") {
    const productName = getString(formData, "product_name");
    if (!productName) {
      throw new Error("商品名は必須です");
    }
  }

  const producerId = await getProducerIdByToken(token);
  const periodId = await getCurrentPeriodId();

  const submissionId = await findOrCreateSubmission({
    producerId,
    periodId,
    status,
  });

  await replaceSubmissionItems({
    submissionId,
    formData,
  });

  revalidatePath(`/entry/${token}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/submissions/${producerId}`);
}

export async function saveDraftAction(formData: FormData) {
  await saveEntry({
    formData,
    status: "draft",
  });
}

export async function submitProposalAction(formData: FormData) {
  await saveEntry({
    formData,
    status: "submitted",
  });
}