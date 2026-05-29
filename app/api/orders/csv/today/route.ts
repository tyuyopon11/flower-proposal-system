import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toJstDateString(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Supabase環境変数が設定されていません。",
      },
      {
        status: 500,
      }
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  const now = new Date();

  const todayJst = toJstDateString(now);

  const startJst = new Date(`${todayJst}T00:00:00+09:00`);

  const endJst = new Date(
    startJst.getTime() + 24 * 60 * 60 * 1000
  );

  const { data, error } = await supabase
    .from("mobile_orders")
    .select(`
      id,
      buyer_no,
      buyer_branch_no,
      buyer_name,
      delivery_date,
      remarks,
      status,
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
    .gte("created_at", startJst.toISOString())
    .lt("created_at", endJst.toISOString())
    .eq("status", "submitted")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }

  const rows: string[] = [];

  rows.push(
    [
      "買参番号",
      "枝番",
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

  const orderIds: string[] = [];

  for (const order of data ?? []) {
    orderIds.push(order.id);

    const items = [...(order.mobile_order_items ?? [])].sort(
      (a: any, b: any) =>
        Number(a.display_order) -
        Number(b.display_order)
    );

    for (const item of items) {
      rows.push(
        [
          order.buyer_no,
          order.buyer_branch_no,
          order.buyer_name,
          order.delivery_date,
          item.product_name,
          item.spec,
          item.irisu ?? "",
          item.case_qty ?? "",
          item.note ?? "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }
  }

  if (orderIds.length > 0) {
    const { error: updateError } = await supabase
      .from("mobile_orders")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .in("id", orderIds);

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message,
        },
        {
          status: 500,
        }
      );
    }
  }

  const bom = "\uFEFF";

  const csv = bom + rows.join("\r\n");

  const fileDate = todayJst.replaceAll("-", "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type":
        "text/csv; charset=utf-8",

      "Content-Disposition":
        `attachment; filename="orders_unprocessed_${fileDate}.csv"`,
    },
  });
}