import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Supabase環境変数がありません。" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { searchParams } = new URL(request.url);
    const buyerNo = String(searchParams.get("buyer_no") || "").trim();
    const buyerBranchNo = String(searchParams.get("buyer_branch_no") || "").trim();

    if (!buyerNo || !buyerBranchNo) {
      return NextResponse.json({ ok: true, buyer: null });
    }

    const { data, error } = await supabase
      .from("buyers")
      .select("buyer_no, buyer_branch_no, buyer_name")
      .eq("buyer_no", buyerNo)
      .eq("buyer_branch_no", buyerBranchNo)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      buyer: data ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "不明なエラーです。",
      },
      { status: 500 }
    );
  }
}