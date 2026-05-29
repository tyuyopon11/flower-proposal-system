import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const orderId = String(body.order_id || "");
    const status = String(body.status || "");

    if (!orderId) {
      return NextResponse.json({ error: "order_id がありません。" }, { status: 400 });
    }

    if (!["submitted", "processed"].includes(status)) {
      return NextResponse.json({ error: "status が不正です。" }, { status: 400 });
    }

    const updateData =
      status === "processed"
        ? { status: "processed", processed_at: new Date().toISOString() }
        : { status: "submitted", processed_at: null };

    const { error } = await supabase
      .from("mobile_orders")
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "不明なエラーです。" },
      { status: 500 }
    );
  }
}