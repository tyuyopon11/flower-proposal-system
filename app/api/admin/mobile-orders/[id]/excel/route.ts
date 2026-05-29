import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const { data: order, error: orderError } = await supabase
      .from("mobile_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "注文データが見つかりません" },
        { status: 404 }
      );
    }

    const { data: items, error: itemsError } = await supabase
      .from("mobile_order_items")
      .select("*")
      .eq("order_id", id)
      .order("display_order", { ascending: true });

    if (itemsError) {
      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "mobile_order_template.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Excelテンプレートが見つかりません" },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const ws = workbook.worksheets[0];

    ws.getCell("A6").value = order.buyer_name || "";
    ws.getCell("HO6").value = order.inputter_name || "";
    ws.getCell("A7").value = order.contact_phone || "";
    ws.getCell("HO7").value = order.delivery_date || "";

    const startRow = 11;

    for (let i = 0; i < (items || []).length; i++) {
      const item = items![i];
      const row = startRow + i;

      ws.getCell(`F${row}`).value = item.product_name || "";
      ws.getCell(`H${row}`).value = item.spec || "";
      ws.getCell(`I${row}`).value = item.irisu ?? "";
      ws.getCell(`G${row}`).value = item.case_qty ?? "";
      ws.getCell(`N${row}`).value = item.case_qty ?? "";
      ws.getCell(`HI${row}`).value = item.note || "";
      ws.getCell(`HO${row}`).value = order.buyer_no || "";
      ws.getCell(`HP${row}`).value = order.buyer_branch_no || "";

      ws.getCell(`ID${row}`).value = "";
      ws.getCell(`IE${row}`).value = "";
      ws.getCell(`IF${row}`).value = "";
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mobile-order-${id}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Excel出力エラー" },
      { status: 500 }
    );
  }
}