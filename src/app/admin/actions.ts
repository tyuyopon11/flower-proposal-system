"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteProducerAction(formData: FormData) {
  const producerId = formData.get("producer_id")?.toString();

  if (!producerId) {
    throw new Error("producer_id がありません");
  }

  const supabase = await createClient();

  const { error: submissionsError } = await supabase
    .from("submissions")
    .delete()
    .eq("producer_id", producerId);

  if (submissionsError) {
    throw new Error(`submissions削除失敗: ${submissionsError.message}`);
  }

  const { error: linksError } = await supabase
    .from("producer_links")
    .delete()
    .eq("producer_id", producerId);

  if (linksError) {
    throw new Error(`producer_links削除失敗: ${linksError.message}`);
  }

  const { error: producersError } = await supabase
    .from("producers")
    .delete()
    .eq("id", producerId);

  if (producersError) {
    throw new Error(`producers削除失敗: ${producersError.message}`);
  }

  revalidatePath("/admin");
}

export async function regenerateProducerUrlAction(formData: FormData) {
  const producerId = formData.get("producer_id")?.toString();

  if (!producerId) {
    throw new Error("producer_id がありません");
  }

  const supabase = await createClient();
  const newToken = randomUUID().replace(/-/g, "");

  const { error: deactivateError } = await supabase
    .from("producer_links")
    .update({ is_active: false })
    .eq("producer_id", producerId)
    .eq("is_active", true);

  if (deactivateError) {
    throw new Error(`既存URL無効化失敗: ${deactivateError.message}`);
  }

  const { error: insertError } = await supabase.from("producer_links").insert({
    producer_id: producerId,
    token: newToken,
    is_active: true,
  });

  if (insertError) {
    throw new Error(`新URL発行失敗: ${insertError.message}`);
  }

  revalidatePath("/admin");
}