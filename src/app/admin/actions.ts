"use server";

import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function regenerateProducerUrlAction(formData: FormData) {
  const producerId = Number(formData.get("producer_id"));

  const supabase = await createClient();

  const token = crypto.randomBytes(24).toString("hex");

  const { error: updateError } = await supabase
    .from("producer_links")
    .update({ is_active: false })
    .eq("producer_id", producerId)
    .eq("is_active", true);

  if (updateError) {
    console.error(updateError);
    return { error: updateError.message };
  }

  const { error: insertError } = await supabase
    .from("producer_links")
    .insert({
      producer_id: producerId,
      token,
      is_active: true,
    });

  if (insertError) {
    console.error(insertError);
    return { error: insertError.message };
  }

  return { success: true };
}