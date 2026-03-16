"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function regenerateProducerUrlAction(formData: FormData) {
  const producerIdValue = formData.get("producer_id");
  const producerId = Number(producerIdValue);

  if (!producerId || Number.isNaN(producerId)) {
    throw new Error("producer_id が不正です");
  }

  const supabase = await createClient();
  const token = crypto.randomBytes(24).toString("hex");

  const { error: updateError } = await supabase
    .from("producer_links")
    .update({ is_active: false })
    .eq("producer_id", producerId)
    .eq("is_active", true);

  if (updateError) {
    throw new Error(`URL無効化失敗: ${updateError.message}`);
  }

  const { error: insertError } = await supabase
    .from("producer_links")
    .insert({
      producer_id: producerId,
      token,
      is_active: true,
    });

  if (insertError) {
    throw new Error(`URL再生成失敗: ${insertError.message}`);
  }

  revalidatePath("/admin");
}

export async function deleteProducerAction(formData: FormData) {
  const producerIdValue = formData.get("producer_id");
  const producerId = Number(producerIdValue);

  if (!producerId || Number.isNaN(producerId)) {
    throw new Error("producer_id が不正です");
  }

  const supabase = await createClient();

  const { error: deleteSubmissionItemsError } = await supabase
    .from("submission_items")
    .delete()
    .in(
      "submission_id",
      (
        await supabase
          .from("submissions")
          .select("id")
          .eq("producer_id", producerId)
      ).data?.map((row) => row.id) ?? []
    );

  if (deleteSubmissionItemsError) {
    throw new Error(
      `submission_items削除失敗: ${deleteSubmissionItemsError.message}`
    );
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