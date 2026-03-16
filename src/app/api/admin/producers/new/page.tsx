import Link from "next/link";
import AddProducerForm from "@/components/admin/add-producer-form";

export const metadata = {
  title: "生産者追加 | Flower Proposal System",
};

export default function NewProducerPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">生産者追加</h1>
            <p className="mt-2 text-sm text-slate-600">
              登録と同時に、生産者専用の入力URLを自動発行します。
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            管理画面に戻る
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AddProducerForm />
        </div>
      </div>
    </main>
  );
}