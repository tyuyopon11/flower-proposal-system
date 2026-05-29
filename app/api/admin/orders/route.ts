import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: orders, error: orderError } = await supabase
    .from("mobile_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  const orderIds = (orders || []).map((o) => o.id);

  const { data: items, error: itemError } = await supabase
    .from("mobile_order_items")
    .select("*")
    .in("order_id", orderIds)
    .order("display_order", { ascending: true });

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  const result = (orders || []).map((order) => ({
    ...order,
    items: (items || []).filter((item) => item.order_id === order.id),
  }));

  return NextResponse.json({ orders: result });
}