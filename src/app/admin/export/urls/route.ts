import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AdminSubmissionStatusRow = {
  id: number;
  producer_name: string;
  token: string;
};

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_submission_status")
    .select("*")
    .order("id");

  if (error) {
    return NextResponse.json(
      { error: `admin_submission_status取得失敗: ${error.message}` },
      { status: 500 }
    );
  }

  const rows = ((data ?? []) as AdminSubmissionStatusRow[]).map((row) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      "https://flower-proposal-system.vercel.app";

    return {
      producer: row.producer_name,
      url: `${baseUrl}/entry/${row.token}`,
    };
  });

  const csv =
    "producer,url\n" +
    rows.map((r) => `${r.producer},${r.url}`).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="producer-urls.csv"',
    },
  });
}