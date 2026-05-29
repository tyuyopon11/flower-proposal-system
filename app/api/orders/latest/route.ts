import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const buyerNo = String(searchParams.get("buyer_no") || "");
    const branchNo = String(searchParams.get("buyer_branch_no") || "");

    if (!buyerNo || !branchNo) {
      return NextResponse.json({ ok: true, order: null });
    }

    const { data, error } = await supabase
      .from("mobile_orders")
      .select(`
        id,
        buyer_no,
        buyer_branch_no,
        buyer_name,
        delivery_date,
        remarks,
        created_at,
        mobile_order_items (
          product_name,
          spec,
          irisuu,
          case_qty,
          display_order
        )
      `)
      .eq("buyer_no", buyerNo)
      .eq("buyer_branch_no", branchNo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({
      ok: true,
      order: data ?? null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "取得エラー",
    });
  }
}