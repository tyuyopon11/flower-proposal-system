'use client'

import { useState } from 'react'

export default function AddProducerForm() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResultUrl(null)

    try {
      const res = await fetch('/api/admin/producers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          producer_name: name,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '作成失敗')
      }

      setResultUrl(data.entry_url)
      setName('')
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-gray-900">生産者追加</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row">
        <input
          type="text"
          placeholder="生産者名を入力"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-500"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? '作成中...' : '追加'}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {resultUrl && (
        <div className="mt-4 rounded-xl bg-green-50 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">入力URL</p>
          <a
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-sm text-green-700 underline"
          >
            {resultUrl}
          </a>
        </div>
      )}
    </div>
  )
}