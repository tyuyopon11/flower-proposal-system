export async function regenerateProducerUrlAction(formData: FormData) {
  const producerId = Number(formData.get("producer_id"));

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