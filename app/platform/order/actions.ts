"use server";

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isShopPubliclyAccessible } from "@/lib/shops/publication";
import {
  auctionCutoffAt,
  auctionWeekday,
} from "@/lib/orders/auction-dates";
import { isAuctionDateWithinProductSalesPeriod, isProductInSalesPeriod } from "@/lib/products/sales-period";
import { getProductReservationStatusLabel, getProductReservationStatus, isProductReservationOpen } from "@/lib/products/reservation-period";
import { calculateLineAmount, calculateTotalUnits } from "@/lib/orders/amounts";

export type CreateOrderInput = {
  productId: string;
  companyName: string;
  buyerNumber: string;
  contactName: string;
  phone: string;
  email: string;
  deliveryDate: string;
  quantity: number;
  note: string;
};

export type CreateOrderResult =
  | {
      success: true;
      orderId: string;
    }
  | {
      success: false;
      message: string;
    };

type BuyerNumberParts = {
  buyerNo: string;
  branchNo: string | null;
};

function normalizeText(value: string): string {
  return value.trim();
}

function splitBuyerNumber(value: string): BuyerNumberParts {
  const normalized = normalizeText(value);

  /*
   * 「1234-01」のような入力は、
   * buyer_no = 1234
   * branch_no = 01
   * として保存します。
   *
   * ハイフンがない場合は、入力全体をbuyer_noへ保存します。
   */
  const match = normalized.match(/^(.+?)[-－ー](.+)$/);

  if (!match) {
    return {
      buyerNo: normalized,
      branchNo: null,
    };
  }

  return {
    buyerNo: match[1].trim(),
    branchNo: match[2].trim() || null,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateInput(
  input: CreateOrderInput
): CreateOrderResult | null {
  // Server Actions are callable independently of the form; validate runtime types.
  if (!input || typeof input !== "object" ||
      ![input.productId, input.companyName, input.buyerNumber, input.contactName,
        input.phone, input.email, input.deliveryDate, input.note]
        .every((value) => typeof value === "string")) {
    return { success: false, message: "注文情報の形式が正しくありません。" };
  }
  const productId = normalizeText(input.productId);
  const companyName = normalizeText(input.companyName);
  const buyerNumber = normalizeText(input.buyerNumber);
  const contactName = normalizeText(input.contactName);
  const phone = normalizeText(input.phone);
  const email = normalizeText(input.email);
  const deliveryDate = normalizeText(input.deliveryDate);

  if (!productId) {
    return {
      success: false,
      message: "商品情報を確認できませんでした。",
    };
  }

  if (!companyName) {
    return {
      success: false,
      message: "店名・屋号を入力してください。",
    };
  }

  if (!buyerNumber) {
    return {
      success: false,
      message: "買参人番号を入力してください。",
    };
  }

  if (!contactName) {
    return {
      success: false,
      message: "購入担当者名を入力してください。",
    };
  }

  if (!phone) {
    return {
      success: false,
      message: "電話番号を入力してください。",
    };
  }

  if (!email) {
    return {
      success: false,
      message: "メールアドレスを入力してください。",
    };
  }

  if (!isValidEmail(email)) {
    return {
      success: false,
      message: "正しいメールアドレスを入力してください。",
    };
  }

  if (!deliveryDate) {
    return {
      success: false,
      message: "納品・受取希望日を入力してください。",
    };
  }

  if (!isValidDate(deliveryDate)) {
    return {
      success: false,
      message: "納品・受取希望日を正しく入力してください。",
    };
  }

  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 || input.quantity > 2147483647
  ) {
    return {
      success: false,
      message: "注文数量を正しく選択してください。",
    };
  }

  return null;
}

export async function createOrder(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  try {
    const validationError = validateInput(input);

    if (validationError) {
      return validationError;
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message:
          "ログイン情報を確認できませんでした。もう一度ログインしてください。",
      };
    }

    const productId = Number(input.productId);

    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0
    ) {
      return {
        success: false,
        message: "商品情報が正しくありません。",
      };
    }

    // A fresh service client has no user session. Use only after verified authentication.
    const orderWriter = createAdminClient();
    const { data: profile, error: profileError } = await orderWriter
      .from("platform_users")
      .select("auth_user_id,role,approval_status,is_active,buyer_no,branch_no,company_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const buyerNo = typeof profile?.buyer_no === "string" ? profile.buyer_no.trim() : "";
    // Optional registered branch: NULL/blank means no branch, never a wildcard.
    const validBranch = profile?.branch_no === null || typeof profile?.branch_no === "string";
    const branchNo = typeof profile?.branch_no === "string" ? profile.branch_no.trim() || null : null;
    const companyName = typeof profile?.company_name === "string" ? profile.company_name.trim() : "";
    if (profileError || !profile || profile.auth_user_id !== user.id ||
        profile.role !== "buyer" || profile.approval_status !== "approved" ||
        profile.is_active !== true || !buyerNo || !validBranch || !companyName) {
      return { success: false, message: "承認済みの買参人情報を確認できませんでした。管理者へお問い合わせください。" };
    }
    const submittedBuyer = splitBuyerNumber(input.buyerNumber);
    if (submittedBuyer.buyerNo !== buyerNo || submittedBuyer.branchNo !== branchNo) {
      return { success: false, message: "買参番号・枝番がログイン中の会員情報と一致しません。" };
    }
    const contactName = normalizeText(input.contactName);
    const phone = normalizeText(input.phone);
    const email = normalizeText(input.email);
    const deliveryDate = normalizeText(
      input.deliveryDate
    );
    const note = normalizeText(input.note);

    /*
     * 保存直前に商品情報と在庫を再確認します。
     * 注文画面を開いた後に売り切れた場合などを防ぎます。
     */
    const {
      data: product,
      error: productError,
    } = await orderWriter
      .from("exhibition_items")
      .select(`
        id,
        quantity,
        irisu,
        price,
        shop_id,
        sales_period_enabled,
        sales_start_date,
        sales_end_date,
        reservation_period_enabled,
        reservation_start_date,
        reservation_end_date,
        shops (
          contact_email,
          published,
          show_on_public_site,
          ordering_enabled,
          accepts_tuesday,
          accepts_saturday,
          order_cutoff_hours
        )
      `)
      .eq("id", productId)
      .eq("published", true)
      .single();

    if (productError || !product) {
      console.error(
        "Order product fetch error:",
        productError
      );

      return {
        success: false,
        message:
          "商品情報を確認できませんでした。商品ページからやり直してください。",
      };
    }

    // Preserve the existing NULL = no quantity limit convention.
    const availableQuantity = product.quantity === null ? null : Number(product.quantity);
    const salesUnit = "case";
    const unitsPerSalesUnit = Number(product.irisu);
    const unitPrice = Number(product.price);
    // Only explicit NULL inventory is unlimited; malformed values still fail closed.
    const missingTerm = [product.irisu, product.price]
      .some((value) => value == null || String(value).trim() === "");
    const invalidQuantity = availableQuantity !== null &&
      (product.quantity === undefined || String(product.quantity).trim() === "" ||
       !Number.isSafeInteger(availableQuantity) || availableQuantity < 0);
    if (missingTerm || invalidQuantity ||
        !Number.isSafeInteger(unitsPerSalesUnit) || unitsPerSalesUnit < 1 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 9999999999.99) {
      return { success: false, message: "商品の価格・入数・在庫情報を確認できませんでした。" };
    }
    const totalUnits = calculateTotalUnits(unitsPerSalesUnit, input.quantity);
    const totalAmount = calculateLineAmount({ unitPrice, unitsPerSalesUnit, quantity: input.quantity });

    if (!Number.isSafeInteger(totalUnits) || totalUnits > 2147483647 ||
        !Number.isFinite(totalAmount) || totalAmount > 999999999999.99) {
      return { success: false, message: "注文数量・金額が保存可能な範囲を超えています。" };
    }

    const shopRelation = Array.isArray(product.shops)
      ? product.shops[0]
      : product.shops;

    if (!isShopPubliclyAccessible(shopRelation)) {
      return {
        success: false,
        message: "このショップは現在公開されていません。",
      };
    }
    if (!isProductInSalesPeriod(product)) {
      return { success: false, message: "この商品は現在、販売期間外のため注文できません。" };
    }
    if (!isProductReservationOpen(product)) {
      return {
        success: false,
        message: getProductReservationStatusLabel(getProductReservationStatus(product)),
      };
    }
    if (!isAuctionDateWithinProductSalesPeriod(product, deliveryDate)) {
      return { success: false, message: "選択した納品希望日は、この商品の販売予定期間外です。" };
    }
    const auctionDate = new Date(`${deliveryDate}T00:00:00+09:00`);
    const auctionDay = auctionWeekday(deliveryDate);
    const acceptsAuctionDay =
      (auctionDay === 2 && shopRelation?.accepts_tuesday) ||
      (auctionDay === 6 && shopRelation?.accepts_saturday);

    const {
      data: configuredAuctionDate,
      error: configuredAuctionDateError,
    } = await supabase
      .from("auction_dates")
      .select("auction_date")
      .eq("auction_date", deliveryDate)
      .eq("is_active", true)
      .maybeSingle();

    // An unavailable calendar is not permission to accept an unconfigured date.
    if (configuredAuctionDateError) {
      console.error(
        "Auction date validation error:",
        configuredAuctionDateError
      );
      return {
        success: false,
        message: "競り日情報を確認できませんでした。時間をおいて再度お試しください。",
      };
    }

    if (
      !shopRelation?.ordering_enabled ||
      !deliveryDate ||
      Number.isNaN(auctionDate.getTime()) ||
      !acceptsAuctionDay ||
      !configuredAuctionDate
    ) {
      return {
        success: false,
        message: "このショップが受付している競り日（火曜・土曜）を選択してください。",
      };
    }

    const cutoffHours = Number(shopRelation.order_cutoff_hours ?? 24);
    if (!Number.isFinite(cutoffHours) || cutoffHours < 0) {
      return { success: false, message: "注文締切の設定を確認できませんでした。" };
    }
    const cutoffAt = auctionCutoffAt(deliveryDate, cutoffHours);
    if (!Number.isFinite(cutoffAt.getTime()) || Date.now() >= cutoffAt.getTime()) {
      return {
        success: false,
        message: "この競り日の注文受付は締め切りました。",
      };
    }

    if (
      availableQuantity !== null &&
      input.quantity > availableQuantity
    ) {
      return {
        success: false,
        message:
          availableQuantity > 0
            ? `現在注文できる数量は${availableQuantity}点までです。`
            : "申し訳ありません。この商品は売り切れました。",
      };
    }

    const { data: orderNumber, error: orderNumberError } =
      await supabase.rpc("next_lei_port_order_number", {
        p_auction_date: deliveryDate,
      });

    if (orderNumberError || !orderNumber) {
      console.error("Order number generation error:", orderNumberError);
      return {
        success: false,
        message: "注文番号を発行できませんでした。時間をおいて再度お試しください。",
      };
    }

    const { data: order, error: insertError } =
      await orderWriter
        .from("exhibition_orders")
        .insert({
          item_id: productId,
          buyer_no: buyerNo,
          branch_no: branchNo,
          buyer_name: companyName,
          contact_name: contactName,
          contact_tel: phone,
          quantity: input.quantity,
          irisu: unitsPerSalesUnit,
          sales_unit: salesUnit,
          units_per_sales_unit: unitsPerSalesUnit,
          total_units: totalUnits,
          unit_price: unitPrice,
          total_amount: totalAmount,
          status: "secured",
          cancelled: false,
          email,
          note: note || null,
          auction_date: deliveryDate,
          order_number: orderNumber,
          delivery_date: null,

          /*
           * 既存の展示販売用カラム。
           * 現時点では注文フォームに対応項目がないため、
           * nullで保存します。
           */
          branch: null,
          contact: null,
        })
        .select("id,order_number")
        .single();

    if (insertError || !order) {
      console.error("Order insert error:", insertError);

      const stockMatch = insertError?.message?.match(/INSUFFICIENT_STOCK:(\d+)/);
      if (stockMatch) {
        const remaining = Number(stockMatch[1]);
        return {
          success: false,
          message:
            remaining > 0
              ? `現在注文できる数量は${remaining}ケースまでです。`
              : "申し訳ありません。この商品は売り切れました。",
        };
      }

      return {
        success: false,
        message:
          "注文の保存に失敗しました。時間をおいてもう一度お試しください。",
      };
    }

    if (shopRelation?.contact_email) {
      const { error: notificationError } = await orderWriter
        .from("order_email_notifications")
        .insert({
          order_id: order.id,
          recipient: shopRelation.contact_email,
          status: "pending",
        });
      if (notificationError) {
        console.error("Order email queue insert error:", notificationError);
      }
    }

    revalidatePath(`/platform/products/${productId}`);
    revalidatePath(`/platform/order/${productId}`);

    return {
      success: true,
      orderId: order.order_number ?? String(order.id),
    };
  } catch (error) {
    console.error("Create order unexpected error:", error);

    return {
      success: false,
      message:
        "注文処理中に予期しないエラーが発生しました。",
    };
  }
}
