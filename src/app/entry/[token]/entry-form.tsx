"use client"

import { useActionState, useEffect, useState } from "react"
import { saveDraftAction, submitProposalAction } from "./actions"

type EntryFormProps = {
  token: string
  initialValues: {
    product_name: string
    spec: string
    quantity: string
    price: string
    shipping_month_1: string
    shipping_month_2: string
    notes: string
    status: string
  }
  producerName: string
}

type FormValues = {
  product_name: string
  spec: string
  quantity: string
  price: string
  shipping_month_1: string
  shipping_month_2: string
  notes: string
  status: string
}

const initialState = {
  message: "",
}

export default function EntryForm({
  token,
  initialValues,
  producerName,
}: EntryFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues)

  const [draftState, draftAction, isDraftPending] = useActionState(
    async (_prevState: typeof initialState, formData: FormData) => {
      await saveDraftAction(formData)
      return { message: "下書きを保存しました" }
    },
    initialState
  )

  const [submitState, submitAction, isSubmitPending] = useActionState(
    async (_prevState: typeof initialState, formData: FormData) => {
      await submitProposalAction(formData)
      return { message: "提出が完了しました" }
    },
    initialState
  )

  useEffect(() => {
    if (draftState.message) {
      setValues((prev) => ({ ...prev, status: "下書き" }))
    }
  }, [draftState.message])

  useEffect(() => {
    if (submitState.message) {
      setValues((prev) => ({ ...prev, status: "提出済み" }))
    }
  }, [submitState.message])

  const disabled = isDraftPending || isSubmitPending

  const hiddenFields = (
    <>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="product_name" value={values.product_name} />
      <input type="hidden" name="spec" value={values.spec} />
      <input type="hidden" name="quantity" value={values.quantity} />
      <input type="hidden" name="price" value={values.price} />
      <input
        type="hidden"
        name="shipping_month_1"
        value={values.shipping_month_1}
      />
      <input
        type="hidden"
        name="shipping_month_2"
        value={values.shipping_month_2}
      />
      <input type="hidden" name="notes" value={values.notes} />
    </>
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-500">生産者</div>
        <div className="mt-1 text-xl font-semibold">{producerName}</div>
        <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm">
          現在の状態: {values.status || "未提出"}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 text-lg font-semibold">商品提案入力</div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">商品名</label>
            <input
              type="text"
              value={values.product_name}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, product_name: e.target.value }))
              }
              className="w-full rounded border px-3 py-2"
              placeholder="例：アルテシマ 7号"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">規格</label>
            <input
              type="text"
              value={values.spec}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, spec: e.target.value }))
              }
              className="w-full rounded border px-3 py-2"
              placeholder="例：7号鉢 / 高さ90cm前後"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">数量</label>
              <input
                type="text"
                value={values.quantity}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, quantity: e.target.value }))
                }
                className="w-full rounded border px-3 py-2"
                placeholder="例：50"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">価格</label>
              <input
                type="text"
                value={values.price}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, price: e.target.value }))
                }
                className="w-full rounded border px-3 py-2"
                placeholder="例：1200"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">出荷月1</label>
              <input
                type="text"
                value={values.shipping_month_1}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    shipping_month_1: e.target.value,
                  }))
                }
                className="w-full rounded border px-3 py-2"
                placeholder="例：4月"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">出荷月2</label>
              <input
                type="text"
                value={values.shipping_month_2}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    shipping_month_2: e.target.value,
                  }))
                }
                className="w-full rounded border px-3 py-2"
                placeholder="例：5月"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">備考</label>
            <textarea
              value={values.notes}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="min-h-[140px] w-full rounded border px-3 py-2"
              placeholder="補足があれば入力してください"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <form action={draftAction}>
            {hiddenFields}
            <button
              type="submit"
              disabled={disabled}
              className="rounded bg-slate-700 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isDraftPending ? "保存中..." : "下書き保存"}
            </button>
          </form>

          <form action={submitAction}>
            {hiddenFields}
            <button
              type="submit"
              disabled={disabled}
              className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitPending ? "提出中..." : "提出する"}
            </button>
          </form>
        </div>

        {(draftState.message || submitState.message) && (
          <div className="mt-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {submitState.message || draftState.message}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
        入力途中でも下書き保存できます。提出後も、URLが有効な限り再入力できます。
      </div>
    </div>
  )
}