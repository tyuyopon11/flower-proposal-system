"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  status: string;
};

export default function OrderStatusButton({ orderId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isProcessed = status === "processed";

  async function toggleStatus() {
    setLoading(true);

    const nextStatus = isProcessed ? "submitted" : "processed";

    await fetch("/api/orders/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        status: nextStatus,
      }),
    });

    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={toggleStatus}
      disabled={loading}
      className={
        isProcessed
          ? "rounded-lg bg-gray-200 px-3 py-2 font-bold text-gray-700"
          : "rounded-lg bg-green-700 px-3 py-2 font-bold text-white"
      }
    >
      {loading ? "更新中..." : isProcessed ? "処理済" : "未処理"}
    </button>
  );
}