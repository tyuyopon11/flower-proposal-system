import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteProducerAction } from "./actions";

type Producer = {
  id: string;
  producer_name: string;
};

type ProducerLink = {
  producer_id: string;
  token: string;
  is_active: boolean | null;
  created_at: string | null;
};

type Submission = {
  producer_id: string;
  status: string | null;
  updated_at: string | null;
  submitted_at: string | null;
};

type AdminRow = {
  id: string;
  producer_name: string;
  status: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  token: string | null;
  is_active: boolean | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

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
      return "下書き";
    case "submitted":
      return "提出済み";
    default:
      return "未提出";
  }
}

function getStatusClass(status: string | null) {
  switch (status) {
    case "draft":
      return "bg-yellow-100 text-yellow-800";
    case "submitted":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: producers, error: producersError } = await supabase
    .from("producers")
    .select("id, producer_name")
    .order("producer_name", { ascending: true });

  if (producersError) {
    throw new Error(`producers取得失敗: ${producersError.message}`);
  }

  const producerList = (producers ?? []) as Producer[];
  const producerIds = producerList.map((producer) => producer.id);

  let links: ProducerLink[] = [];
  let submissions: Submission[] = [];

  if (producerIds.length > 0) {
    const { data: linksData, error: linksError } = await supabase
      .from("producer_links")
      .select("producer_id, token, is_active, created_at")
      .in("producer_id", producerIds)
      .order("created_at", { ascending: false });

    if (linksError) {
      throw new Error(`producer_links取得失敗: ${linksError.message}`);
    }

    links = (linksData ?? []) as ProducerLink[];

    const { data: submissionsData, error: submissionsError } = await supabase
      .from("submissions")
      .select("producer_id, status, updated_at, submitted_at");

    if (submissionsError) {
      throw new Error(`submissions取得失敗: ${submissionsError.message}`);
    }

    submissions = ((submissionsData ?? []) as Submission[]).filter((item) =>
      producerIds.includes(item.producer_id)
    );
  }

  const latestLinkMap = new Map<
    string,
    {
      token: string | null;
      is_active: boolean | null;
    }
  >();

  for (const link of links) {
    if (!latestLinkMap.has(link.producer_id)) {
      latestLinkMap.set(link.producer_id, {
        token: link.token,
        is_active: link.is_active,
      });
    }
  }

  const submissionMap = new Map<
    string,
    {
      status: string | null;
      updated_at: string | null;
      submitted_at: string | null;
    }
  >();

  for (const submission of submissions) {
    const existing = submissionMap.get(submission.producer_id);

    if (!existing) {
      submissionMap.set(submission.producer_id, {
        status: submission.status,
        updated_at: submission.updated_at,
        submitted_at: submission.submitted_at,
      });
      continue;
    }

    const existingTime = existing.updated_at
      ? new Date(existing.updated_at).getTime()
      : 0;
    const currentTime = submission.updated_at
      ? new Date(submission.updated_at).getTime()
      : 0;

    if (currentTime >= existingTime) {
      submissionMap.set(submission.producer_id, {
        status: submission.status,
        updated_at: submission.updated_at,
        submitted_at: submission.submitted_at,
      });
    }
  }

  const rows: AdminRow[] = producerList.map((producer) => {
    const link = latestLinkMap.get(producer.id);
    const submission = submissionMap.get(producer.id);

    return {
      id: producer.id,
      producer_name: producer.producer_name,
      status: submission?.status ?? null,
      updated_at: submission?.updated_at ?? null,
      submitted_at: submission?.submitted_at ?? null,
      token: link?.token ?? null,
      is_active: link?.is_active ?? null,
    };
  });

  const totalCount = rows.length;
  const notSubmittedCount = rows.filter((row) => !row.status).length;
  const draftCount = rows.filter((row) => row.status === "draft").length;
  const submittedCount = rows.filter((row) => row.status === "submitted").length;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              花き提案回収システム 管理画面
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              生産者ごとの提出状況、入力URL、各種操作を確認できます。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/producers/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              生産者追加
            </Link>
            <a
              href="/admin/export/urls"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              URL一覧CSV
            </a>
            <a
              href="/admin/export/unsubmitted"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              未提出CSV
            </a>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">総生産者数</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{totalCount}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">未提出</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {notSubmittedCount}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">下書き</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{draftCount}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">提出済み</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {submittedCount}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">提出状況一覧</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    生産者
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    最終保存
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    提出日時
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    入力URL
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      生産者データがありません
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const entryUrl = row.token ? `${appUrl}/entry/${row.token}` : null;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 align-top last:border-b-0"
                      >
                        <td className="px-4 py-4 font-medium text-gray-900">
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

                        <td className="px-4 py-4 text-gray-700">
                          {formatDate(row.updated_at)}
                        </td>

                        <td className="px-4 py-4 text-gray-700">
                          {formatDate(row.submitted_at)}
                        </td>

                        <td className="px-4 py-4">
                          {entryUrl ? (
                            <a
                              href={entryUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-blue-600 underline hover:text-blue-800"
                            >
                              {entryUrl}
                            </a>
                          ) : (
                            <span className="text-gray-400">URL未発行</span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <form action={deleteProducerAction}>
                              <input
                                type="hidden"
                                name="producer_id"
                                value={row.id}
                              />
                              <button
                                type="submit"
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
                              >
                                削除
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}