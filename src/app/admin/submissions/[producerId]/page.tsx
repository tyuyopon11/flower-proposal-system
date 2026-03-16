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

type SubmissionItemRecord = {
  id?: number | string;
  submission_id?: number | string | null;
  item_no?: number | string | null;
  display_order?: number | string | null;
  product_name?: string | null;
  item_name?: string | null;
  flower_name?: string | null;
  spec?: string | null;
  standard?: string | null;
  quantity?: string | number | null;
  qty?: string | number | null;
  price?: string | number | null;
  unit_price?: string | number | null;
  shipping_month_1?: string | null;
  shipping_month_2?: string | null;
  shipping_date?: string | null;
  notes?: string | null;
  remark?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

function getItemName(item: SubmissionItemRecord) {
  return (
    item.product_name ??
    item.item_name ??
    item.flower_name ??
    "-"
  );
}

function getItemSpec(item: SubmissionItemRecord) {
  return item.spec ?? item.standard ?? "-";
}

function getItemQuantity(item: SubmissionItemRecord) {
  return item.quantity ?? item.qty ?? "-";
}

function getItemPrice(item: SubmissionItemRecord) {
  return item.price ?? item.unit_price ?? "-";
}

function getItemShipping1(item: SubmissionItemRecord) {
  return item.shipping_month_1 ?? item.shipping_date ?? "-";
}

function getItemShipping2(item: SubmissionItemRecord) {
  return item.shipping_month_2 ?? "-";
}

function getItemNotes(item: SubmissionItemRecord) {
  return item.notes ?? item.remark ?? "-";
}

function getItemSortValue(item: SubmissionItemRecord) {
  const displayOrder = Number(item.display_order ?? item.item_no ?? 0);
  if (!Number.isNaN(displayOrder) && displayOrder > 0) {
    return displayOrder;
  }

  const idNumber = Number(item.id ?? 0);
  if (!Number.isNaN(idNumber) && idNumber > 0) {
    return idNumber;
  }

  return 999999;
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

  let submissionItems: SubmissionItemRecord[] = [];

  if (latestSubmission?.id) {
    const { data: itemsData, error: itemsError } = await supabase
      .from("submission_items")
      .select("*")
      .eq("submission_id", latestSubmission.id);

    if (itemsError) {
      throw new Error(`submission_items取得失敗: ${itemsError.message}`);
    }

    submissionItems = ((itemsData ?? []) as SubmissionItemRecord[]).sort(
      (a, b) => getItemSortValue(a) - getItemSortValue(b)
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
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

          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            管理画面に戻る
          </Link>
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    提出商品一覧
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    submission_items に保存されている商品明細を表示します。
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {submissionItems.length} 件
                </div>
              </div>

              {submissionItems.length === 0 ? (
                <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  submission_items に商品明細がまだありません。
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          No
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          商品名
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          規格
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          数量
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          価格
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          出荷月1
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          出荷月2
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">
                          備考
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {submissionItems.map((item, index) => (
                        <tr key={String(item.id ?? index)}>
                          <td className="px-4 py-3 text-slate-600">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {displayValue(getItemName(item))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {displayValue(getItemSpec(item))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {displayValue(getItemQuantity(item))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {displayValue(getItemPrice(item))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {displayValue(getItemShipping1(item))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {displayValue(getItemShipping2(item))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="max-w-[280px] whitespace-pre-wrap">
                              {displayValue(getItemNotes(item))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                生データ確認
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                現在保存されている submission レコード全体を表示しています。
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