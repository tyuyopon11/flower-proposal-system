"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function regenerateProducerUrlAction(formData: FormData) {
  const producerId = Number(formData.get("producer_id"));

  if (!producerId || Number.isNaN(producerId)) {
    throw new Error("producer_id が不正です");
  }

  const supabase = await createClient();
  const token = crypto.randomBytes(24).toString("hex");

  const { error } = await supabase
    .from("producer_links")
    .update({
      token,
      is_active: true,
    })
    .eq("producer_id", producerId);

  if (error) {
    throw new Error(`URL再生成失敗: ${error.message}`);
  }

  revalidatePath("/admin");
}

export async function deleteProducerAction(formData: FormData) {
  const producerId = Number(formData.get("producer_id"));

  if (!producerId || Number.isNaN(producerId)) {
    throw new Error("producer_id が不正です");
  }

  const supabase = await createClient();

  const { data: submissionRows, error: submissionsLookupError } = await supabase
    .from("submissions")
    .select("id")
    .eq("producer_id", producerId);

  if (submissionsLookupError) {
    throw new Error(`submissions取得失敗: ${submissionsLookupError.message}`);
  }

  const submissionIds = (submissionRows ?? []).map((row) => row.id);

  if (submissionIds.length > 0) {
    const { error: deleteSubmissionItemsError } = await supabase
      .from("submission_items")
      .delete()
      .in("submission_id", submissionIds);

    if (deleteSubmissionItemsError) {
      throw new Error(
        `submission_items削除失敗: ${deleteSubmissionItemsError.message}`
      );
    }
  }

  const { error: deleteSubmissionsError } = await supabase
    .from("submissions")
    .delete()
    .eq("producer_id", producerId);

  if (deleteSubmissionsError) {
    throw new Error(`submissions削除失敗: ${deleteSubmissionsError.message}`);
  }

  const { error: deleteLinksError } = await supabase
    .from("producer_links")
    .delete()
    .eq("producer_id", producerId);

  if (deleteLinksError) {
    throw new Error(`producer_links削除失敗: ${deleteLinksError.message}`);
  }

  const { error: deleteProducerError } = await supabase
    .from("producers")
    .delete()
    .eq("id", producerId);

  if (deleteProducerError) {
    throw new Error(`producers削除失敗: ${deleteProducerError.message}`);
  }

  revalidatePath("/admin");
}