"use client";

import Link from "next/link";
import { useState } from "react";

export default function ExhibitionImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload() {
    if (!file) {
      setMessage("Excelファイルを選択してください。");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/exhibition/import", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(`取込完了：${result.exhibitionName}（${result.itemCount}件）`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取込に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 p-5 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/exhibition" className="text-sm font-semibold text-green-800">
          ← 商品管理へ戻る
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-stone-900">商品Excel取込</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          正式フォーマットは CIRQNEX Import Template v1.1 です。
          入数は1ケースの鉢数、数量は販売可能ケース数として取り込みます。
        </p>

        <section className="mt-7 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <a
            href="/templates/LeiPort_Import_Template_v1.1.xlsx"
            download
            className="inline-flex rounded-full border border-green-700 px-5 py-3 text-sm font-bold text-green-800"
          >
            正式テンプレート Ver1.1をダウンロード
          </a>
          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-6 block w-full rounded-xl border border-stone-300 bg-stone-50 p-3 text-sm"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading}
            className="mt-4 w-full rounded-full bg-green-800 px-5 py-4 font-bold text-white disabled:opacity-50"
          >
            {loading ? "取込中…" : "商品を取り込む"}
          </button>
          {message && (
            <div role="status" className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
              {message}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
          商品番号・商品名・入数・数量（ケース数）・価格は必須です。
          列名または列順が正式テンプレートと異なるファイルは取り込みません。
          <p className="mt-3">
            P〜S列は「受付開始日・受付終了日・販売開始日・販売終了日」です。
            予約受付期間と販売期間はそれぞれ任意で、開始日と終了日をセットで入力すると期間設定が有効になります。
            両方空欄なら期間設定なしです。有効／無効の入力は不要です。
          </p>
          <p className="mt-2">
            日付はYYYY-MM-DD（例：2026-09-08）で入力してください。
            終了日は開始日以降にしてください（同日も可）。
            期間列のない旧Excelも、両期間とも設定なしとして取り込めます。
            「展示会設定」シートの日付は商品の期間設定には使用しません。
          </p>
        </section>
      </div>
    </main>
  );
}
