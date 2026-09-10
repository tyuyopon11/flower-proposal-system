import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canManageShop } from "@/lib/auth/shop-access";
import { isProductCategory, PRODUCT_CATEGORIES } from "@/lib/products/categories";
import { parseProductReservationPeriod, validateProductReservationPeriod } from "@/lib/products/reservation-period";
import { parseProductSalesPeriod, validateProductSalesPeriod } from "@/lib/products/sales-period";

import { getPlatformAccess, isApprovedPlatformAdmin, isApprovedShopUser } from "@/lib/auth/platform-user";

export async function GET() {
  const access = await getPlatformAccess();
  if (!isApprovedPlatformAdmin(access) && !isApprovedShopUser(access)) {
    return NextResponse.json({ error: "展示会一覧を取得する権限がありません。" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin.from("exhibitions")
    .select("id,name,is_active,start_date,end_date").order("id", { ascending: false });
  if (error) return NextResponse.json({ error: "展示会一覧を取得できませんでした。" }, { status: 500 });
  return NextResponse.json({ exhibitions: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

const PRODUCT_HEADERS = [
  "商品番号",
  "商品名",
  "カテゴリー",
  "品目",
  "品種",
  "樹高",
  "樹形",
  "鉢サイズ",
  "入数",
  "数量（ケース数）",
  "価格",
  "産地",
  "生産者",
  "コメント",
  "JFコード",
] as const;

const PERIOD_HEADERS = ["受付開始日", "受付終了日", "販売開始日", "販売終了日"] as const;

// Normalize Excel date cells and typed dates for the individual-product validators.
function productDate(value: unknown): string | null {
  let text: string;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    text = value.toISOString().slice(0, 10);
  } else if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    text = `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  } else if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (!match) return null;
    text = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  } else {
    return null;
  }
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}

const HEADER_ALIASES: Partial<Record<(typeof PRODUCT_HEADERS)[number], readonly string[]>> = {
  "数量（ケース数）": ["数量"],
};

function cellText(sheet: XLSX.WorkSheet, address: string) {
  const value = sheet[address]?.v;
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeHeader(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "");
}

function isCompatibleHeader(expected: (typeof PRODUCT_HEADERS)[number], actual: string) {
  const accepted = [expected, ...(HEADER_ALIASES[expected] ?? [])];
  const normalizedActual = normalizeHeader(actual);
  return accepted.some((value) => normalizeHeader(value) === normalizedActual);
}

function cellNumber(sheet: XLSX.WorkSheet, address: string) {
  const value = sheet[address]?.v;
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").replace(/¥/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function excelDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value).trim().replaceAll("/", "-");
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)
    ? text.split("-").map((part, index) => index === 0 ? part : part.padStart(2, "0")).join("-")
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const mode = String(formData.get("mode") ?? "create");
    if (mode !== "create" && mode !== "append") {
      return NextResponse.json({ error: "取込モードが不正です。" }, { status: 400 });
    }
    const append = mode === "append";
    const exhibitionId = String(formData.get("exhibitionId") ?? "").trim();
    if (append && !exhibitionId) {
      return NextResponse.json({ error: "追加先の展示会を選択してください。" }, { status: 400 });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Excelファイルを選択してください。" }, { status: 400 });
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: true,
    });
    const settingSheet = workbook.Sheets["展示会設定"];
    const itemSheet = workbook.Sheets["商品リスト"];

    if (!settingSheet || !itemSheet) {
      return NextResponse.json(
        { error: "正式テンプレートの「展示会設定」「商品リスト」シートが必要です。" },
        { status: 400 }
      );
    }

    const actualHeaders = PRODUCT_HEADERS.map((_, index) =>
      cellText(itemSheet, `${XLSX.utils.encode_col(index)}3`)
    );
    const mismatches = PRODUCT_HEADERS.flatMap((expected, index) => {
      const actual = actualHeaders[index];
      return isCompatibleHeader(expected, actual)
        ? []
        : [{ column: XLSX.utils.encode_col(index), expected, actual }];
    });

    if (mismatches.length > 0) {
      const first = mismatches[0];
      return NextResponse.json(
        {
          error: `商品リスト3行目の列順が正式テンプレートと一致しません。列${first.column}は「${first.expected}」にしてください。`,
          expectedHeaders: PRODUCT_HEADERS,
          actualHeaders,
          mismatches,
        },
        { status: 400 }
      );
    }

    const exhibitionName = cellText(settingSheet, "B4");
    const shopName = cellText(settingSheet, "B8");
    if ((!append && !exhibitionName) || !shopName) {
      return NextResponse.json(
        { error: append ? "展示会設定シートのショップ名は必須です。" : "展示会名とショップ名は必須です。" },
        { status: 400 }
      );
    }

    const { data: shop, error: shopError } = await supabaseAdmin
      .from("shops")
      .select("id,shop_name")
      .eq("shop_name", shopName)
      .maybeSingle();
    if (shopError || !shop) {
      return NextResponse.json(
        { error: `ショップ「${shopName}」が登録されていません。` },
        { status: 400 }
      );
    }

    const manager = await canManageShop(shop.id);
    if (!manager) {
      return NextResponse.json(
        { error: "このショップの商品を取り込む権限がありません。" },
        { status: 403 }
      );
    }

    const range = XLSX.utils.decode_range(itemSheet["!ref"] ?? "A1:O1");
    const hasPeriodColumns = PERIOD_HEADERS.some((_, index) => cellText(itemSheet, `${XLSX.utils.encode_col(15 + index)}3`) !== "");
    if (hasPeriodColumns) {
      for (const [index, header] of PERIOD_HEADERS.entries()) {
        if (normalizeHeader(cellText(itemSheet, `${XLSX.utils.encode_col(15 + index)}3`)) !== normalizeHeader(header)) {
          return NextResponse.json({ error: `商品リスト3行目の列${XLSX.utils.encode_col(15 + index)}は「${header}」にしてください。` }, { status: 400 });
        }
      }
    }
    const rows: Record<string, unknown>[] = [];

    for (let row = 4; row <= range.e.r + 1; row += 1) {
      const itemNo = append ? null : cellNumber(itemSheet, `A${row}`);
      const productName = cellText(itemSheet, `B${row}`);
      if (append) {
        // Ignore column A, but do not silently skip a row with other product data.
        if (!Array.from({ length: 18 }, (_, index) => cellText(itemSheet, `${XLSX.utils.encode_col(index + 1)}${row}`)).some(Boolean)) continue;
      } else if (itemNo === null && !productName) continue;

      const irisu = cellNumber(itemSheet, `I${row}`);
      const quantity = cellNumber(itemSheet, `J${row}`);
      const price = cellNumber(itemSheet, `K${row}`);
      const category = cellText(itemSheet, `C${row}`);

      if (!append && (itemNo === null || !Number.isInteger(itemNo) || itemNo < 1)) {
        return NextResponse.json({ error: `${row}行目の商品番号は1以上の整数で入力してください。` }, { status: 400 });
      }
      if (!productName) {
        return NextResponse.json({ error: `${row}行目の商品名は必須です。` }, { status: 400 });
      }
      if (!isProductCategory(category)) {
        return NextResponse.json(
          { error: `${row}行目のカテゴリーは「${PRODUCT_CATEGORIES.join("、")}」から入力してください。` },
          { status: 400 }
        );
      }
      if (irisu === null || !Number.isInteger(irisu) || irisu < 1) {
        return NextResponse.json({ error: `${row}行目の入数は1以上の整数で入力してください。` }, { status: 400 });
      }
      if (quantity === null || !Number.isInteger(quantity) || quantity < 0) {
        return NextResponse.json({ error: `${row}行目の数量（ケース数）は0以上の整数で入力してください。` }, { status: 400 });
      }
      if (price === null || price < 0) {
        return NextResponse.json({ error: `${row}行目の価格は0以上の数値で入力してください。` }, { status: 400 });
      }

      const periodData = new FormData();
      for (const [offset, prefix] of [[0, "reservation"], [2, "sales"]] as const) {
        const values = [0, 1].map((index) => hasPeriodColumns ? itemSheet[`${XLSX.utils.encode_col(15 + offset + index)}${row}`]?.v : undefined);
        const entered = values.map((value) => value !== undefined && value !== null && String(value).trim() !== "");
        if (entered[0] !== entered[1]) {
          const missing = PERIOD_HEADERS[offset + (entered[0] ? 1 : 0)];
          return NextResponse.json({ error: `${row}行目の${missing}を入力してください。開始日と終了日はセットで入力してください。` }, { status: 400 });
        }
        if (!entered[0]) continue;
        periodData.set(`${prefix}PeriodEnabled`, "on");
        for (const [index, suffix] of ["StartDate", "EndDate"].entries()) {
          const date = productDate(values[index]);
          if (!date) {
            return NextResponse.json({ error: `${row}行目の${PERIOD_HEADERS[offset + index]}は有効な日付（YYYY-MM-DD）で入力してください。` }, { status: 400 });
          }
          periodData.set(`${prefix}${suffix}`, date);
        }
      }
      const reservationPeriod = parseProductReservationPeriod(periodData);
      const salesPeriod = parseProductSalesPeriod(periodData);
      const periodError = validateProductReservationPeriod(reservationPeriod) ?? validateProductSalesPeriod(salesPeriod);
      if (periodError) {
        return NextResponse.json({ error: `${row}行目：${periodError}` }, { status: 400 });
      }

      rows.push({
        ...(append ? { _excel_row: row } : {}),
        ...reservationPeriod,
        ...salesPeriod,
        item_no: itemNo,
        product_name: productName,
        category,
        item: cellText(itemSheet, `D${row}`),
        variety: cellText(itemSheet, `E${row}`),
        tree_height: cellText(itemSheet, `F${row}`),
        tree_shape: cellText(itemSheet, `G${row}`),
        pot_size: cellText(itemSheet, `H${row}`),
        irisu,
        quantity,
        price,
        sales_unit: "case",
        units_per_sales_unit: irisu,
        origin: cellText(itemSheet, `L${row}`),
        producer: cellText(itemSheet, `M${row}`),
        comment: cellText(itemSheet, `N${row}`),
        jf_code: cellText(itemSheet, `O${row}`) || null,
        staff: null,
        status: quantity === 0 ? "sold" : "preparing",
        input_completed: false,
        shop_id: shop.id,
      });
    }

    if (!rows.length) {
      return NextResponse.json({ error: "取込対象の商品がありません。" }, { status: 400 });
    }

    if (append) {
      const { data, error } = await supabaseAdmin.rpc("append_exhibition_items", {
        p_exhibition_id: exhibitionId, p_shop_id: shop.id, p_items: rows,
      });
      if (error) {
        const missing = error.code === "P0002";
        const invalid = missing || ["23505", "23503", "23514", "23502", "22003", "22023", "22P02"].includes(error.code ?? "");
        return NextResponse.json({ error: missing ? "追加先の展示会が見つかりません。" :
          /^\d+行目：/.test(error.message) ? error.message :
          "追加取込に失敗しました。追加先と入力内容を確認してください。" }, { status: invalid ? 400 : 500 });
      }
      return NextResponse.json({ ...data, shopName: shop.shop_name, message: "既存展示会へ非公開の商品を追加しました。" });
    }

    await supabaseAdmin.from("exhibitions").update({ is_active: false }).eq("is_active", true);
    const { data: exhibition, error: exhibitionError } = await supabaseAdmin
      .from("exhibitions")
      .insert({
        name: exhibitionName,
        start_date: excelDate(settingSheet["B5"]?.v),
        end_date: excelDate(settingSheet["B6"]?.v),
        category: cellText(settingSheet, "B7"),
        is_active: true,
      })
      .select("id")
      .single();

    if (exhibitionError || !exhibition) {
      return NextResponse.json(
        { error: exhibitionError?.message ?? "展示会を登録できませんでした。" },
        { status: 500 }
      );
    }

    const { error: itemsError } = await supabaseAdmin
      .from("exhibition_items")
      .insert(rows.map((row) => ({ ...row, exhibition_id: exhibition.id })));
    if (itemsError) {
      await supabaseAdmin.from("exhibitions").delete().eq("id", exhibition.id);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "CIRQNEX Import Template v1.1 の取込が完了しました。",
      exhibitionName,
      shopName: shop.shop_name,
      itemCount: rows.length,
    });
  } catch (error) {
    console.error("[Lei Port] Excel import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取込中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
