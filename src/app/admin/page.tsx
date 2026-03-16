import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CopyUrlButton from "./_components/copy-url-button";

type Row = {
  id: number;
  producer_name: string;
  token: string;
  status: string | null;
  submitted_at: string | null;
  last_saved_at: string | null;
};

export default async function AdminPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_submission_status")
    .select("*")
    .order("id");

  if (error) {
    throw new Error(`admin_submission_status取得失敗: ${error.message}`);
  }

  const rows = (data ?? []) as Row[];

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    "https://flower-proposal-system.vercel.app";

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">提出状況一覧</h1>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-3 text-left">生産者</th>
            <th className="p-3">状態</th>
            <th className="p-3">最終保存</th>
            <th className="p-3">提出日時</th>
            <th className="p-3">入力URL</th>
            <th className="p-3">操作</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const url = `${baseUrl}/entry/${row.token}`;

            return (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.producer_name}</td>

                <td className="text-center">{row.status ?? "未提出"}</td>

                <td className="text-center">{row.last_saved_at ?? "-"}</td>

                <td className="text-center">{row.submitted_at ?? "-"}</td>

                <td className="p-3">
                  <a
                    href={url}
                    className="text-blue-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {url}
                  </a>
                </td>

                <td className="p-3">
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/admin/submissions/${row.id}`}
                      className="rounded border px-3 py-2 text-center text-xs"
                    >
                      閲覧
                    </Link>

                    <CopyUrlButton url={url} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}