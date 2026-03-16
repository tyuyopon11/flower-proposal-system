"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type CreateProducerResponse = {
  message?: string;
  error?: string;
  entry_url?: string;
  token?: string;
  producer?: {
    id: string;
    producer_name: string;
  };
};

export default function AddProducerForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const trimmedName = useMemo(() => name.trim(), [name]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!trimmedName) {
      setError("生産者名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);
    setResultUrl(null);
    setCopied(false);

    try {
      const res = await fetch("/api/admin/producers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ producer_name: trimmedName }),
      });

      const data = (await res.json()) as CreateProducerResponse;

      if (!res.ok) {
        throw new Error(data.error || "作成に失敗しました");
      }

      setResultUrl(data.entry_url ?? null);
      setName("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!resultUrl) return;

    try {
      await navigator.clipboard.writeText(resultUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("URLのコピーに失敗しました");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">新規生産者登録</h2>
        <p className="mt-2 text-sm text-slate-600">
          生産者名を登録すると、専用入力URLを即時発行します。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="producer_name"
            className="text-sm font-medium text-slate-700"
          >
            生産者名
          </label>
          <input
            id="producer_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：○○園芸"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "登録中..." : "生産者を追加"}
          </button>

          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            キャンセル
          </Link>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {resultUrl && (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              入力URLを発行しました
            </p>
            <p className="mt-1 break-all text-sm text-emerald-800">{resultUrl}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {copied ? "コピー済み" : "URLをコピー"}
            </button>

            <a
              href={resultUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              入力画面を開く
            </a>
          </div>
        </div>
      )}
    </div>
  );
}