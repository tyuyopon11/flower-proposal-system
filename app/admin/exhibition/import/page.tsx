"use client";

import Link from "next/link";
import { useState } from "react";

export default function ExhibitionImportPage() {
  const [mode, setMode] = useState<"create" | "append">("create");
  const [exhibitionId, setExhibitionId] = useState("");
  const [exhibitions, setExhibitions] = useState<{ id: string | number; name: string; is_active: boolean; start_date: string | null; end_date: string | null }[]>([]);
  const [listLoading, setListLoading] = useState(false);
  async function loadExhibitions() {
    setListLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/exhibition/import", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setExhibitions(result.exhibitions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "展示会一覧を取得できませんでした。");
    } finally { setListLoading(false); }
  }
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload() {
    if (!file) {
      setMessage("Excelファイルを選択してください。");
      return;
    }
    if (mode === "append" && !exhibitionId) {
      setMessage("追加先の展示会を選択してください。");
      return;
    }
    try {
      setLoading(true);
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (mode === "append") formData.append("exhibitionId", exhibitionId);
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
          <fieldset disabled={loading} className="mb-6 space-y-3">
            <legend className="mb-3 font-bold">取込方法</legend>
            <label className="block"><input type="radio" name="mode" checked={mode === "create"} onChange={() => setMode("create")} /> 新しい展示会を作成</label>
            <label className="block"><input type="radio" name="mode" checked={mode === "append"} onChange={() => { setMode("append"); void loadExhibitions(); }} /> 既存展示会へ商品を追加</label>
            {mode === "append" && <div className="space-y-3">
              <label className="block" htmlFor="exhibitionId">追加先の展示会</label>
              <select id="exhibitionId" value={exhibitionId} disabled={listLoading} onChange={event => setExhibitionId(event.target.value)} className="w-full rounded-xl border border-stone-300 p-3">
                <option value="">{listLoading ? "読み込み中…" : "展示会を選択してください"}</option>
                {exhibitions.map(exhibition => <option key={exhibition.id} value={String(exhibition.id)}>
                  {exhibition.name}（{exhibition.is_active ? "有効" : "無効"}・ID: {exhibition.id}）
                </option>)}
              </select>
              <button type="button" onClick={() => void loadExhibitions()} disabled={listLoading} className="text-sm underline">一覧を再取得</button>
              <p className="text-sm leading-6 text-stone-600">A列の商品番号は無視して自動採番します。展示会設定シートはショップ名のみ使用し、展示会名・期間等は変更しません。追加商品は非公開で保存されます。</p>
            </div>}
          </fieldset>
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
            disabled={loading || (mode === "append" && (listLoading || !exhibitionId))}
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
