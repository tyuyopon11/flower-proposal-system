export default function EntryNotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">無効なURLです</h1>
        <p className="mt-3 text-slate-600">
          この入力URLは無効、または再発行済みの可能性があります。
        </p>
      </div>
    </main>
  )
}