import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("mobile_orders")
    .select(`
      id,
      buyer_no,
      buyer_name,
      delivery_date,
      remarks,
      created_at,
      mobile_order_items (
        product_name,
        spec,
        irisu,
        case_qty,
        note,
        display_order
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: string[] = [];

  rows.push(
    [
      "買参番号",
      "買参人名",
      "納品希望日",
      "品名",
      "規格",
      "入数",
      "数量",
      "備考",
    ]
      .map(csvEscape)
      .join(",")
  );

  for (const order of data ?? []) {
    const items = [...(order.mobile_order_items ?? [])].sort(
      (a: any, b: any) => Number(a.display_order) - Number(b.display_order)
    );

    for (const item of items) {
      rows.push(
        [
          order.buyer_no,
          order.buyer_name,
          order.delivery_date,
          item.product_name,
          item.spec,
          item.irisu,
          item.case_qty,
          item.note ?? "", // ← memo から note に変更
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  const bom = "\uFEFF";
  const csv = bom + rows.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders.csv"`,
    },
  });
}