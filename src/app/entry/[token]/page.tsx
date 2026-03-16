import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EntryForm from "./entry-form";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function EntryPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: link, error: linkError } = await supabase
    .from("producer_links")
    .select("producer_id, token, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (linkError) {
    throw new Error(`producer_links取得失敗: ${linkError.message}`);
  }

  if (!link) {
    notFound();
  }

  const [
    { data: producer, error: producerError },
    { data: submission, error: submissionError },
  ] = await Promise.all([
    supabase
      .from("producers")
      .select("id, producer_name")
      .eq("id", link.producer_id)
      .single(),
    supabase
      .from("submissions")
      .select("producer_id, status, submitted_at, last_saved_at")
      .eq("producer_id", link.producer_id)
      .maybeSingle(),
  ]);

  if (producerError) {
    throw new Error(`producers取得失敗: ${producerError.message}`);
  }

  if (submissionError) {
    throw new Error(`submissions取得失敗: ${submissionError.message}`);
  }

  const statusLabel =
    submission?.status === "submitted"
      ? "提出済み"
      : submission?.status === "draft"
      ? "下書き"
      : "未提出";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            花き提案入力フォーム
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            生産者ごとの専用URLです。入力内容は管理画面に反映されます。
          </p>
        </div>

        <EntryForm
          token={token}
          producerName={producer.producer_name ?? "名称未設定"}
          initialValues={{
            product_name: "",
            spec: "",
            quantity: "",
            price: "",
            shipping_month_1: "",
            shipping_month_2: "",
            notes: "",
            status: statusLabel,
          }}
        />
      </div>
    </div>
  );
}