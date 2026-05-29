import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      buyer_no,
      buyer_branch_no,
      buyer_name,
      inputter_name,
      contact_phone,
      delivery_date,
      items,
    } = body;

    if (!buyer_no || !buyer_branch_no || !buyer_name) {
      return NextResponse.json(
        { error: "買参番号・枝番・買参人名は必須です" },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("mobile_orders")
      .insert({
        buyer_no: String(buyer_no),
        buyer_branch_no: String(buyer_branch_no),
        buyer_name: String(buyer_name),
        inputter_name: inputter_name ? String(inputter_name) : "",
        contact_phone: contact_phone ? String(contact_phone) : "",
        delivery_date: delivery_date || null,
        status: "submitted",
        processed: false,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("orderError", orderError);
      return NextResponse.json(
        { error: orderError?.message || "注文保存に失敗しました" },
        { status: 500 }
      );
    }

    const insertItems = (items || [])
      .filter((item: any) => item.product_name && String(item.product_name).trim() !== "")
      .map((item: any, index: number) => ({
        order_id: order.id,
        product_name: String(item.product_name || ""),
        spec: String(item.spec || ""),
        irisu:
          item.irisu === "" || item.irisu === null || item.irisu === undefined
            ? null
            : Number(item.irisu),
        case_qty: String(item.case_qty || ""),
        note: String(item.note || ""),
        display_order: index + 1,
      }));

    if (insertItems.length > 0) {
      const { error: itemError } = await supabase
        .from("mobile_order_items")
        .insert(insertItems);

      if (itemError) {
        console.error("itemError", itemError);
        return NextResponse.json({ error: itemError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, order_id: order.id });
  } catch (error: any) {
    console.error("orders api error", error);
    return NextResponse.json(
      { error: error.message || "注文保存エラー" },
      { status: 500 }
    );
  }
}