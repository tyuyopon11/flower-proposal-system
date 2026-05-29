"use client";

import { useState } from "react";

type Item = {
  product_name: string;
  spec: string;
  irisu: string;
  case_qty: string;
  note: string;
};

export default function OrderPage() {
  const [buyerNo, setBuyerNo] = useState("");
  const [buyerBranchNo, setBuyerBranchNo] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [inputterName, setInputterName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [items, setItems] = useState<Item[]>([
    { product_name: "", spec: "", irisu: "", case_qty: "", note: "" },
  ]);
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const lookupBuyer = async () => {
    if (!buyerNo || !buyerBranchNo) return;

    const res = await fetch(
      `/api/buyers/lookup?buyer_no=${buyerNo}&buyer_branch_no=${buyerBranchNo}`
    );
    const data = await res.json();

    if (data?.buyer_name) {
      setBuyerName(data.buyer_name);
    }
  };

  const updateItem = (index: number, key: keyof Item, value: string) => {
    const next = [...items];
    next[index][key] = value;
    setItems(next);
  };

  const addItem = () => {
    setItems([
      ...items,
      { product_name: "", spec: "", irisu: "", case_qty: "", note: "" },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const validItems = items.filter((item) => item.product_name.trim() !== "");

  const openConfirm = () => {
    setMessage("");

    if (!buyerNo.trim()) {
      setMessage("買参番号を入力してください");
      return;
    }

    if (!buyerBranchNo.trim()) {
      setMessage("枝番を入力してください");
      return;
    }

    if (!buyerName.trim()) {
      setMessage("買参人名を入力してください");
      return;
    }

    if (validItems.length === 0) {
      setMessage("商品を1件以上入力してください");
      return;
    }

    setShowConfirm(true);
  };

  const submitOrder = async () => {
    setSending(true);
    setMessage("");

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        buyer_no: buyerNo,
        buyer_branch_no: buyerBranchNo,
        buyer_name: buyerName,
        inputter_name: inputterName,
        contact_phone: contactPhone,
        delivery_date: deliveryDate || null,
        items,
      }),
    });

    setSending(false);

    if (!res.ok) {
      setMessage("送信に失敗しました");
      setShowConfirm(false);
      return;
    }

    setShowConfirm(false);
    setMessage("注文を送信しました！");

    setBuyerNo("");
    setBuyerBranchNo("");
    setBuyerName("");
    setInputterName("");
    setContactPhone("");
    setDeliveryDate("");
    setItems([{ product_name: "", spec: "", irisu: "", case_qty: "", note: "" }]);
  };

  return (
    <main className="min-h-screen bg-green-50 px-4 py-5">
      <div className="mx-auto max-w-md space-y-5">
        <header className="rounded-2xl bg-white p-5 shadow">
          <h1 className="text-3xl font-black leading-snug text-green-900">
            東京フラワーポート㈱
            <br />
            発注アプリ
          </h1>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow space-y-4">
          <Field
            label="買参番号"
            value={buyerNo}
            setValue={setBuyerNo}
            onBlur={lookupBuyer}
          />
          <Field
            label="枝番"
            value={buyerBranchNo}
            setValue={setBuyerBranchNo}
            onBlur={lookupBuyer}
          />
          <Field
            label="買参人名"
            value={buyerName}
            setValue={setBuyerName}
          />
          <Field
            label="入力者名"
            value={inputterName}
            setValue={setInputterName}
            placeholder="例：田中"
          />
          <Field
            label="連絡先（携帯）"
            value={contactPhone}
            setValue={setContactPhone}
            placeholder="例：090-0000-0000"
          />

          <label className="block space-y-1">
            <span className="block text-base font-bold text-green-900">
              納品希望日
            </span>
            <input
              type="date"
              className="block w-full rounded-xl border border-green-200 bg-white p-3 text-lg"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </label>
        </section>

        {items.map((item, index) => (
          <section key={index} className="rounded-2xl bg-white p-5 shadow space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-green-900">
                商品 {index + 1}
              </h2>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-full bg-red-100 px-3 py-1 text-sm font-black text-red-700"
                >
                  削除
                </button>
              )}
            </div>

            <Field
              label="品名"
              value={item.product_name}
              setValue={(v) => updateItem(index, "product_name", v)}
            />
            <Field
              label="規格"
              value={item.spec}
              setValue={(v) => updateItem(index, "spec", v)}
            />
            <Field
              label="入数"
              value={item.irisu}
              setValue={(v) => updateItem(index, "irisu", v)}
            />
            <Field
              label="数量"
              value={item.case_qty}
              setValue={(v) => updateItem(index, "case_qty", v)}
            />
            <Field
              label="備考"
              value={item.note}
              setValue={(v) => updateItem(index, "note", v)}
            />
          </section>
        ))}

        <button
          onClick={addItem}
          className="w-full rounded-2xl bg-green-200 p-4 text-lg font-black text-green-900 shadow"
        >
          ＋ 商品を追加
        </button>

        <button
          onClick={openConfirm}
          className="w-full rounded-2xl bg-green-700 p-4 text-lg font-black text-white shadow"
        >
          注文内容を確認
        </button>

        {message && (
          <p className="rounded-2xl bg-white p-4 text-center text-lg font-bold text-green-800 shadow">
            {message}
          </p>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-2xl font-black text-green-900">
              注文内容の確認
            </h2>

            <div className="rounded-xl bg-green-50 p-4 space-y-2 font-bold text-gray-800">
              <p>買参番号：{buyerNo}-{buyerBranchNo}</p>
              <p>買参人名：{buyerName}</p>
              <p>入力者名：{inputterName || "未入力"}</p>
              <p>連絡先：{contactPhone || "未入力"}</p>
              <p>納品希望日：{deliveryDate || "未入力"}</p>
            </div>

            <div className="space-y-3">
              <h3 className="font-black text-green-900">
                商品明細（{validItems.length}件）
              </h3>

              {validItems.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-lg font-black text-gray-900">
                    {index + 1}. {item.product_name}
                  </p>
                  <p className="font-bold text-gray-700">
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
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="rounded-xl bg-gray-200 p-4 font-black text-gray-800"
              >
                修正する
              </button>

              <button
                type="button"
                onClick={submitOrder}
                disabled={sending}
                className="rounded-xl bg-green-700 p-4 font-black text-white disabled:bg-gray-400"
              >
                {sending ? "送信中..." : "この内容で送信"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  setValue,
  placeholder,
  onBlur,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-base font-bold text-green-900">{label}</span>
      <input
        className="block w-full rounded-xl border border-green-200 bg-white p-3 text-lg"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
      />
    </label>
  );
}