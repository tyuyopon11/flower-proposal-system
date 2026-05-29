import { createClient } from "@supabase/supabase-js";
import OrderStatusButton from "./OrderStatusButton";

type Order = {
  id: string;
  buyer_no: string;
  buyer_branch_no: string;
  buyer_name: string;
  delivery_date: string;
  status: string;
  processed_at: string | null;
  created_at: string;
  mobile_order_items: { id: string }[];
};

async function getOrders(): Promise<Order[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("mobile_orders")
    .select(`
      id,
      buyer_no,
      buyer_branch_no,
      buyer_name,
      delivery_date,
      status,
      processed_at,
      created_at,
      mobile_order_items(id)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data as Order[];
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP");
}

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">注文一覧</h1>

          <div className="flex gap-3">
            <a
              href="/api/orders/csv/today"
              className="rounded-xl bg-green-700 px-4 py-3 font-bold text-white"
            >
              当日未処理CSV
            </a>

            <a
              href="/api/orders/excel/today"
              className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white"
            >
              当日未処理Excel
            </a>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">状態</th>
                <th className="p-3">注文日</th>
                <th className="p-3">買参人番号</th>
                <th className="p-3">枝番</th>
                <th className="p-3">買参人名</th>
                <th className="p-3">納品希望日</th>
                <th className="p-3 text-center">商品数</th>
                <th className="p-3">処理日時</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="p-3">
                    <OrderStatusButton orderId={order.id} status={order.status} />
                  </td>
                  <td className="p-3">{formatDateTime(order.created_at)}</td>
                  <td className="p-3 font-bold">{order.buyer_no}</td>
                  <td className="p-3 font-bold">{order.buyer_branch_no}</td>
                  <td className="p-3">{order.buyer_name}</td>
                  <td className="p-3">{order.delivery_date}</td>
                  <td className="p-3 text-center">
                    {order.mobile_order_items.length}
                  </td>
                  <td className="p-3">{formatDateTime(order.processed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {orders.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              注文データがありません
            </div>
          )}
        </div>
      </div>
    </main>
  );
}