import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    producerId: string;
  }>;
};

type Producer = {
  id: number | string;
  producer_name: string | null;
};

type SubmissionRecord = {
  id?: number | string;
  producer_id?: number | string;
  period_id?: number | string | null;
  status?: string | null;
  submitted_at?: string | null;
  last_saved_at?: string | null;
  product_name?: string | null;
  spec?: string | null;
  quantity?: string | null;
  price?: string | null;
  shipping_month_1?: string | null;
  shipping_month_2?: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
    case "下書き":
      return "下書き";
    case "submitted":
    case "提出済み":
      return "提出済み";
    default:
      return "未提出";
  }
}

function getStatusClass(status: string | null | undefined) {
  switch (status) {
    case "draft":
    case "下書き":
      return "bg-yellow-100 text-yellow-800";
    case "submitted":
    case "提出済み":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export default async function AdminSubmissionDetailPage({
  params,
}: PageProps) {
  const { producerId } = await params;
  const supabase = await createClient();

  const { data: producer, error: producerError } = await supabase
    .from("producers")
    .select("id, producer_name")
    .eq("id", producerId)
    .maybeSingle();

  if (producerError) {
    throw new Error(`producers取得失敗: ${producerError.message}`);
  }

  if (!producer) {
    notFound();
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("submissions")
    .select("*")
    .eq("producer_id", producerId);

  if (submissionsError) {
    throw new Error(`submissions取得失敗: ${submissionsError.message}`);
  }

  const submissionList = ((submissions ?? []) as SubmissionRecord[]).sort(
    (a, b) => {
      const aTime = new Date(
        String(a.last_saved_at ?? a.submitted_at ?? 0)
      ).getTime();
      const bTime = new Date(
        String(b.last_saved_at ?? b.submitted_at ?? 0)
      ).getTime();

      return bTime - aTime;
    }
  );

  const latestSubmission = submissionList[0] ?? null;

  const producerData = producer as Producer;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-500">提出内容閲覧</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {producerData.producer_name ?? "名称未設定"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              生産者ごとの最新提出内容を確認できます。
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              管理画面に戻る
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">状態</p>
            <div className="mt-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusClass(
                  latestSubmission?.status
                )}`}
              >
                {getStatusLabel(latestSubmission?.status)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">最終保存</p>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {formatDate(latestSubmission?.last_saved_at)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">提出日時</p>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {formatDate(latestSubmission?.submitted_at)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">提案回ID</p>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {displayValue(latestSubmission?.period_id)}
            </p>
          </div>
        </section>

        {!latestSubmission ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-center text-sm text-slate-500">
              まだ提出データがありません。
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                提出内容詳細
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">商品名</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {displayValue(latestSubmission.product_name)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">規格</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {displayValue(latestSubmission.spec)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">数量</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {displayValue(latestSubmission.quantity)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">価格</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {displayValue(latestSubmission.price)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">出荷月1</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {displayValue(latestSubmission.shipping_month_1)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">出荷月2</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {displayValue(latestSubmission.shipping_month_2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">備考</p>
                <p className="mt-2 whitespace-pre-wrap text-base font-medium text-slate-900">
                  {displayValue(latestSubmission.notes)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                生データ確認
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                今後の項目追加に備えて、現在保存されている submission レコード全体を表示しています。
              </p>

              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
{JSON.stringify(latestSubmission, null, 2)}
              </pre>
            </section>
          </>
        )}
      </div>
    </main>
  );
}