"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  product_name: string;
  spec?: string;
  irisu?: string | number;
  case_qty?: string;
  note?: string;
};

type Order = {
  id: string;
  buyer_no: string;
  buyer_branch_no: string;
  buyer_name: string;
  inputter_name?: string;
  contact_phone?: string;
  delivery_date?: string;
  processed?: boolean;
  created_at: string;
  items?: Item[];
};

type ConfirmTarget = {
  id: string;
  buyer_name: string;
  delivery_date?: string;
  processed: boolean;
} | null;

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<
    "today" | "unprocessed" | "processed" | "all"
  >("today");

  const loadOrders = async () => {
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    const data = await res.json();
    setOrders(data.orders || []);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const todayCount = orders.filter(
    (order) => order.created_at?.slice(0, 10) === today
  ).length;

  const unprocessedCount = orders.filter((order) => !order.processed).length;
  const processedCount = orders.filter((order) => order.processed).length;

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (filter === "today" && order.created_at?.slice(0, 10) !== today)
        return false;
      if (filter === "unprocessed" && order.processed) return false;
      if (filter === "processed" && !order.processed) return false;

      const itemText = (order.items || [])
        .map((i) =>
          [i.product_name, i.spec, i.irisu, i.case_qty, i.note].join(" ")
        )
        .join(" ");

      const text = [
        order.buyer_no,
        order.buyer_branch_no,
        order.buyer_name,
        order.inputter_name,
        order.contact_phone,
        order.delivery_date,
        itemText,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(keyword.toLowerCase());
    });
  }, [orders, keyword, filter, today]);

  const toggleOrder = (id: string) => {
    setExpandedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const updateProcessed = async (id: string, processed: boolean) => {
    await fetch(`/api/admin/orders/${id}/processed`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processed }),
    });

    setConfirmTarget(null);

    setOrders((prev) =>
      prev.map((order) =>
        order.id === id
          ? {
             ...order,
             processed,
            }
          : order
      )
    );

    await loadOrders();
  };

  return (
    <main className="min-h-screen bg-green-50 px-4 py-5">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl bg-white p-5 shadow">
          <h1 className="text-3xl font-black text-green-900">発注管理画面</h1>
          <p className="mt-2 text-sm font-bold text-green-700">
            東京フラワーポート㈱ 発注アプリ
          </p>
        </header>

        <section className="grid grid-cols-3 gap-2">
          <StatusCard label="本日注文" count={todayCount} color="green" />
          <StatusCard label="未処理" count={unprocessedCount} color="orange" />
          <StatusCard label="処理済み" count={processedCount} color="gray" />
        </section>

        <section className="rounded-2xl bg-white p-4 shadow space-y-3">
          <input
            className="w-full rounded-xl border border-green-200 p-3 text-lg"
            placeholder="買参人名・商品名・入力者名で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setFilter("today")}
              className={buttonClass(filter === "today")}
            >
              本日
            </button>
            <button
              onClick={() => setFilter("unprocessed")}
              className={buttonClass(filter === "unprocessed")}
            >
              未処理
            </button>
            <button
              onClick={() => setFilter("processed")}
              className={buttonClass(filter === "processed")}
            >
              処理済み
            </button>
            <button
              onClick={() => setFilter("all")}
              className={buttonClass(filter === "all")}
            >
              すべて
            </button>
          </div>

          <button
            onClick={loadOrders}
            className="w-full rounded-xl bg-green-100 p-3 font-black text-green-900"
          >
            再読み込み
          </button>
        </section>

        <section className="space-y-4">
          {filteredOrders.length === 0 && (
            <p className="rounded-2xl bg-white p-5 text-center font-bold shadow">
              注文はありません
            </p>
          )}

          {filteredOrders.map((order) => {
            const itemCount = (order.items || []).length;
            const totalQty = (order.items || []).reduce(
              (sum, item) => {
                const qty = parseFloat(
                  String(item.case_qty || "0").replace(/[^\d.-]/g, "")
                );

                return sum + (isNaN(qty) ? 0 : qty);
              },
              0
            );
            const isOpen = expandedOrders.includes(order.id);

            return (
              <div
                key={order.id}
                className={
                  order.processed
                    ? "rounded-2xl border border-gray-200 bg-white p-5 shadow space-y-4"
                    : "rounded-2xl border-2 border-orange-300 bg-white p-5 shadow space-y-4"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-green-900">
                      {order.buyer_name || "買参人名 未入力"}
                    </p>
                    <p className="mt-1 text-base font-black text-gray-700">
                      {order.buyer_no || "未入力"}-
                      {order.buyer_branch_no || "未入力"}
                    </p>
                  </div>

                  <span className={order.processed ? badgeGray() : badgeOrange()}>
                    {order.processed ? "処理済み" : "未処理"}
                  </span>
                </div>

                <div className="grid gap-3 rounded-xl bg-green-50 p-4">
                  <DeliveryDateInfo value={order.delivery_date} />
                  <Info label="入力者名" value={order.inputter_name} />
                  <Info label="連絡先" value={order.contact_phone} />
                  <Info
                    label="注文日時"
                    value={formatDateTime(order.created_at)}
                    required={false}
                  />
                </div>

                <div className="rounded-xl bg-gray-50 p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleOrder(order.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 font-black text-green-900"
                  >
                    <div className="flex flex-col items-start">
                      <span>
                        商品明細（{itemCount}件）
                      </span>

                      <span className="text-sm text-green-700">
                       合計数量：{totalQty}
                      </span>
                    </div>
                    <span>{isOpen ? "▼ 閉じる" : "▶ 表示"}</span>
                  </button>

                  {isOpen && (
                    <div className="space-y-3">
                      {itemCount === 0 ? (
                        <p className="rounded-xl bg-red-50 p-3 font-bold text-red-700">
                          商品明細なし
                        </p>
                      ) : (
                        (order.items || []).map((item, index) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <p className="text-lg font-black text-gray-900">
                              {index + 1}. {item.product_name || "品名未入力"}
                            </p>
                            <p className="mt-1 font-bold text-gray-700">
                              規格：{item.spec || "未入力"}
                            </p>
                            <p className="font-bold text-gray-700">
                              入数：{item.irisu || "未入力"}
                            </p>
                            <p className="font-bold text-gray-700">
                              数量：{item.case_qty || "未入力"}
                            </p>
                            <p className="font-bold text-gray-700">
                              備考：{item.note || "未入力"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <a
                    href={`/api/admin/mobile-orders/${order.id}/excel`}
                    className="block rounded-xl bg-green-700 p-4 text-center text-lg font-black text-white"
                  >
                    Excel出力
                  </a>

                  {order.processed ? (
                    <button
                      onClick={() =>
                        setConfirmTarget({
                          id: order.id,
                          buyer_name: order.buyer_name || "買参人名 未入力",
                          delivery_date: order.delivery_date,
                          processed: false,
                        })
                      }
                      className="rounded-xl bg-red-500 p-4 text-lg font-black text-white"
                    >
                      未処理に戻す
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setConfirmTarget({
                          id: order.id,
                          buyer_name: order.buyer_name || "買参人名 未入力",
                          delivery_date: order.delivery_date,
                          processed: true,
                        })
                      }
                      className="rounded-xl bg-green-600 p-4 text-lg font-black text-white"
                    >
                      処理済みにする
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-2xl font-black text-green-900">
              確認
            </h2>

            <p className="font-bold text-gray-800">
              この注文を
              <span className={confirmTarget.processed ? "text-green-700" : "text-red-700"}>
                {confirmTarget.processed ? " 処理済み " : " 未処理 "}
              </span>
              に変更しますか？
            </p>

            <div className="rounded-xl bg-green-50 p-4 space-y-2 font-bold text-gray-800">
              <p>買参人：{confirmTarget.buyer_name}</p>
              <p>納品希望日：{confirmTarget.delivery_date || "未入力"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl bg-gray-200 p-4 font-black text-gray-800"
              >
                キャンセル
              </button>

              <button
                onClick={() =>
                  updateProcessed(confirmTarget.id, confirmTarget.processed)
                }
                className={
                  confirmTarget.processed
                    ? "rounded-xl bg-green-600 p-4 font-black text-white"
                    : "rounded-xl bg-red-500 p-4 font-black text-white"
                }
              >
                {confirmTarget.processed ? "処理済みにする" : "未処理に戻す"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatusCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "green" | "orange" | "gray";
}) {
  const className =
    color === "green"
      ? "bg-green-700 text-white"
      : color === "orange"
      ? "bg-orange-500 text-white"
      : "bg-gray-200 text-gray-800";

  return (
    <div className={`rounded-2xl p-4 text-center shadow ${className}`}>
      <p className="text-sm font-black">{label}</p>
      <p className="text-3xl font-black">{count}</p>
    </div>
  );
}

function DeliveryDateInfo({ value }: { value?: string }) {
  if (!value) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-green-100 pb-2">
        <span className="font-black text-green-900">納品希望日</span>
        <span className="rounded-full bg-red-100 px-3 py-1 font-black text-red-700">
          未入力
        </span>
      </div>
    );
  }

  const today = new Date();
  const target = new Date(value);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff =
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  let badge = "";
  let cls = "";

  if (diff < 0) {
    badge = "期限超過";
    cls = "bg-gray-200 text-gray-700";
  } else if (diff === 0) {
    badge = "今日";
    cls = "bg-red-100 text-red-700";
  } else if (diff === 1) {
    badge = "明日";
    cls = "bg-orange-100 text-orange-700";
  } else {
    badge = "予定";
    cls = "bg-green-100 text-green-700";
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-green-100 pb-2">
      <span className="font-black text-green-900">納品希望日</span>
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-800">{value}</span>
        <span className={`rounded-full px-3 py-1 text-sm font-black ${cls}`}>
          {badge}
        </span>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  required = true,
}: {
  label: string;
  value?: string;
  required?: boolean;
}) {
  const empty = required && (!value || value.trim() === "");

  return (
    <div className="flex items-center justify-between gap-3 border-b border-green-100 pb-2 last:border-b-0">
      <span className="font-black text-green-900">{label}</span>
      {empty ? (
        <span className="rounded-full bg-red-100 px-3 py-1 font-black text-red-700">
          未入力
        </span>
      ) : (
        <span className="text-right font-bold text-gray-800">{value}</span>
      )}
    </div>
  );
}

function buttonClass(active: boolean) {
  return active
    ? "rounded-xl bg-green-700 p-3 font-black text-white"
    : "rounded-xl bg-green-100 p-3 font-black text-green-900";
}

function badgeGray() {
  return "rounded-full bg-gray-200 px-4 py-2 text-sm font-black text-gray-700";
}

function badgeOrange() {
  return "rounded-full bg-orange-100 px-4 py-2 text-sm font-black text-orange-700";
}

function formatDateTime(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP");
}