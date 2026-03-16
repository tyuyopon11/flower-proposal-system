import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildEntryUrl } from "@/lib/app-url";
import CopyUrlButton from "./_components/copy-url-button";
import {
  deleteProducerAction,
  regenerateProducerUrlAction,
} from "./actions";

type Producer = {
  id: number | string;
  producer_name: string | null;
};

type ProducerLink = {
  producer_id: number | string;
  token: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type Submission = {
  producer_id: number | string;
  period_id: number | string | null;
  status: string | null;
  submitted_at: string | null;
  last_saved_at: string | null;
};

type AdminRow = {
  id: string;
  producer_name: string;
  status: string | null;
  last_saved_at: string | null;
  submitted_at: string | null;
  token: string | null;
  is_active: boolean | null;
};

function toId(value: number | string) {
  return String(value);
}

function formatDate(value: string | null) {
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

function getStatusLabel(status: string | null) {
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

function getStatusClass(status: string | null) {
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

function getSubmissionSortTime(submission: Submission) {
  const base = submission.last_saved_at ?? submission.submitted_at ?? null;
  if (!base) return 0;

  const time = new Date(base).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: producersData, error: producersError } = await supabase
    .from("producers")
    .select("id, producer_name")
    .order("producer_name", { ascending: true });

  if (producersError) {
    throw new Error(`producers取得失敗: ${producersError.message}`);
  }

  const producers = (producersData ?? []) as Producer[];
  const producerIds = producers.map((producer) => producer.id);

  let links: ProducerLink[] = [];
  let submissions: Submission[] = [];

  if (producerIds.length > 0) {
    const [
      { data: linksData, error: linksError },
      { data: submissionsData, error: submissionsError },
    ] = await Promise.all([
      supabase
        .from("producer_links")
        .select("producer_id, token, is_active, created_at")
        .in("producer_id", producerIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("submissions")
        .select("producer_id, period_id, status, submitted_at, last_saved_at")
        .in("producer_id", producerIds),
    ]);

    if (linksError) {
      throw new Error(`producer_links取得失敗: ${linksError.message}`);
    }

    if (submissionsError) {
      throw new Error(`submissions取得失敗: ${submissionsError.message}`);
    }

    links = (linksData ?? []) as ProducerLink[];
    submissions = (submissionsData ?? []) as Submission[];
  }

  const latestActiveLinkMap = new Map<string, ProducerLink>();

  for (const link of links) {
    const producerId = toId(link.producer_id);

    if (link.is_active === false) continue;
    if (latestActiveLinkMap.has(producerId)) continue;

    latestActiveLinkMap.set(producerId, link);
  }

  const latestSubmissionMap = new Map<string, Submission>();

  for (const submission of submissions) {
    const producerId = toId(submission.producer_id);
    const current = latestSubmissionMap.get(producerId);

    if (!current) {
      latestSubmissionMap.set(producerId, submission);
      continue;
    }

    if (getSubmissionSortTime(submission) >= getSubmissionSortTime(current)) {
      latestSubmissionMap.set(producerId, submission);
    }
  }

  const rows: AdminRow[] = producers.map((producer) => {
    const producerId = toId(producer.id);
    const link = latestActiveLinkMap.get(producerId);
    const submission = latestSubmissionMap.get(producerId);

    return {
      id: producerId,
      producer_name: producer.producer_name ?? "名称未設定",
      status: submission?.status ?? null,
      last_saved_at: submission?.last_saved_at ?? null,
      submitted_at: submission?.submitted_at ?? null,
      token: link?.token ?? null,
      is_active: link?.is_active ?? null,
    };
  });

  const totalCount = rows.length;
  const notSubmittedCount = rows.filter((row) => !row.status).length;
  const draftCount = rows.filter(
    (row) => row.status === "draft" || row.status === "下書き"
  ).length;
  const submittedCount = rows.filter(
    (row) => row.status === "submitted" || row.status === "提出済み"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              花き提案回収システム 管理画面
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              生産者ごとの提出状況、入力URL、各種操作を確認できます。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/producers/new"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              生産者追加
            </Link>

            <Link
              href="/admin/export/urls"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              URL一覧CSV
            </Link>

            <Link
              href="/admin/export/unsubmitted"
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              未提出CSV
            </Link>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">総生産者数</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalCount}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">未提出</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {notSubmittedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">下書き</p>
            <p className="mt-2 text-3xl font-bold text-yellow-600">{draftCount}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">提出済み</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {submittedCount}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">提出状況一覧</h2>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              生産者データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      生産者
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      状態
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      最終保存
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      提出日時
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      入力URL
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const entryUrl = row.token ? buildEntryUrl(row.token) : null;

                    return (
                      <tr key={row.id} className="align-top">
                        <td className="px-4 py-4 font-medium text-slate-900">
                          {row.producer_name}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              row.status
                            )}`}
                          >
                            {getStatusLabel(row.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-slate-600">
                          {formatDate(row.last_saved_at)}
                        </td>

                        <td className="px-4 py-4 text-slate-600">
                          {formatDate(row.submitted_at)}
                        </td>

                        <td className="px-4 py-4">
                          {entryUrl ? (
                            <div className="space-y-2">
                              <a
                                href={entryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block max-w-[320px] break-all text-emerald-700 underline underline-offset-2"
                              >
                                {entryUrl}
                              </a>
                              <CopyUrlButton url={entryUrl} />
                            </div>
                          ) : (
                            <span className="text-slate-400">URL未発行</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <Link
                              href={`/admin/submissions/${row.id}`}
                              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-center text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              閲覧
                            </Link>

                            <form action={regenerateProducerUrlAction}>
                              <input
                                type="hidden"
                                name="producer_id"
                                value={row.id}
                              />
                              <button
                                type="submit"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                URL再発行
                              </button>
                            </form>

                            <form action={deleteProducerAction}>
                              <input
                                type="hidden"
                                name="producer_id"
                                value={row.id}
                              />
                              <button
                                type="submit"
                                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                削除
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}