"use client"

import { deleteProducerAction } from "../actions"

type DeleteProducerFormProps = {
  producerId: string
}

export default function DeleteProducerForm({
  producerId,
}: DeleteProducerFormProps) {
  return (
    <form
      action={deleteProducerAction}
      onSubmit={(e) => {
        const ok = window.confirm("この生産者を削除します。よろしいですか？")
        if (!ok) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="producer_id" value={producerId} />
      <button
        type="submit"
        className="rounded bg-rose-600 px-3 py-1 text-white hover:bg-rose-700"
      >
        削除
      </button>
    </form>
  )
}