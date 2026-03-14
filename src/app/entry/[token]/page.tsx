import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import EntryForm from "./entry-form"

type PageProps = {
  params: Promise<{
    token: string
  }>
}

export default async function EntryPage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()

  const { data: link, error: linkError } = await supabase
    .from("producer_links")
    .select("producer_id, token, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle()

  if (linkError) {
    throw new Error(linkError.message)
  }

  if (!link) {
    notFound()
  }

  const [{ data: producer, error: producerError }, { data: submission, error: submissionError }] =
    await Promise.all([
      supabase
        .from("producers")
        .select("id, producer_name")
        .eq("id", link.producer_id)
        .single(),
      supabase
        .from("submissions")
        .select(`
          producer_id,
          product_name,
          spec,
          quantity,
          price,
          shipping_month_1,
          shipping_month_2,
          notes,
          status
        `)
        .eq("producer_id", link.producer_id)
        .maybeSingle(),
    ])

  if (producerError) {
    throw new Error(producerError.message)
  }

  if (submissionError) {
    throw new Error(submissionError.message)
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-3xl font-bold">花き提案入力フォーム</h1>

      <EntryForm
        token={token}
        producerName={producer.producer_name}
        initialValues={{
          product_name: submission?.product_name ?? "",
          spec: submission?.spec ?? "",
          quantity: submission?.quantity ?? "",
          price: submission?.price ?? "",
          shipping_month_1: submission?.shipping_month_1 ?? "",
          shipping_month_2: submission?.shipping_month_2 ?? "",
          notes: submission?.notes ?? "",
          status: submission?.status ?? "未提出",
        }}
      />
    </main>
  )
}