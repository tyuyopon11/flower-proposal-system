import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("mobile_orders")
      .select(`
        buyer_no,
        buyer_branch_no,
        mobile_order_items (
          product_name,
          spec,
          case_qty,
          irisu,
          note
        )
      `)
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Supabase取得エラー: ${error.message}`,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "注文データが存在しません。",
        },
        { status: 404 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("発注");

    // ヘッダ
    sheet.getCell("HO11").value = data.buyer_no ?? "";
    sheet.getCell("HP11").value = data.buyer_branch_no ?? "";

    let row = 11;

    const items = Array.isArray(data.mobile_order_items)
      ? data.mobile_order_items
      : [];

    for (const item of items) {
      sheet.getCell(`F${row}`).value = item.product_name ?? "";
      sheet.getCell(`H${row}`).value = item.spec ?? "";
      sheet.getCell(`I${row}`).value = item.irisu ?? "";
      sheet.getCell(`N${row}`).value = item.case_qty ?? "";
      sheet.getCell(`HI${row}`).value = item.note ?? "";
      row++;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="order.xlsx"',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Excel出力に失敗しました。";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}