"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function addProducerAction(formData: FormData) {
  const producerName = String(formData.get("producer_name") ?? "").trim()

  if (!producerName) {
    throw new Error("生産者名を入力してください")
  }

  const supabase = await createClient()

  const { data: producer, error: producerError } = await supabase
    .from("producers")
    .insert({
      producer_name: producerName,
    })
    .select("id")
    .single()

  if (producerError) {
    throw producerError
  }

  const { data: tokenData, error: tokenError } = await supabase.rpc(
    "generate_entry_token"
  )

  if (tokenError) {
    throw tokenError
  }

  const { error: linkError } = await supabase.from("producer_links").insert({
    producer_id: producer.id,
    token: tokenData,
    is_active: true,
  })

  if (linkError) {
    throw linkError
  }

  revalidatePath("/admin")
}

export async function reissueProducerLinkAction(formData: FormData) {
  const producerId = String(formData.get("producer_id") ?? "").trim()

  if (!producerId) {
    throw new Error("producer_id がありません")
  }

  const supabase = await createClient()

  const { error: deactivateError } = await supabase
    .from("producer_links")
    .update({ is_active: false })
    .eq("producer_id", producerId)
    .eq("is_active", true)

  if (deactivateError) {
    throw deactivateError
  }

  const { data: tokenData, error: tokenError } = await supabase.rpc(
    "generate_entry_token"
  )

  if (tokenError) {
    throw tokenError
  }

  const { error: insertError } = await supabase.from("producer_links").insert({
    producer_id: producerId,
    token: tokenData,
    is_active: true,
  })

  if (insertError) {
    throw insertError
  }

  revalidatePath("/admin")
}

export async function deleteProducerAction(formData: FormData) {
  const producerId = String(formData.get("producer_id") ?? "").trim()

  if (!producerId) {
    throw new Error("producer_id がありません")
  }

  const supabase = await createClient()

  const { error: submissionsError } = await supabase
    .from("submissions")
    .delete()
    .eq("producer_id", producerId)

  if (submissionsError) {
    throw submissionsError
  }

  const { error: linksError } = await supabase
    .from("producer_links")
    .delete()
    .eq("producer_id", producerId)

  if (linksError) {
    throw linksError
  }

  const { error: producerError } = await supabase
    .from("producers")
    .delete()
    .eq("id", producerId)

  if (producerError) {
    throw producerError
  }

  revalidatePath("/admin")
}