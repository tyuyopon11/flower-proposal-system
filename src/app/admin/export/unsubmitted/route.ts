import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const [{ data: producers, error: producersError }, { data: submissions, error: submissionsError }] =
    await Promise.all([
      supabase
        .from("producers")
        .select("id, producer_name")
        .order("producer_name", { ascending: true }),
      supabase
        .from("submissions")
        .select("producer_id, status, updated_at, submitted_at"),
    ])

  if (producersError) {
    return NextResponse.json(
      { error: producersError.message },
      { status: 500 }
    )
  }

  if (submissionsError) {
    return NextResponse.json(
      { error: submissionsError.message },
      { status: 500 }
    )
  }

  const submissionMap = new Map<
    string,
    { status: string | null; updated_at?: string | null; submitted_at?: string | null }
  >()

  for (const submission of submissions ?? []) {
    const current = submissionMap.get(submission.producer_id)

    if (!current) {
      submissionMap.set(submission.producer_id, submission)
      continue
    }

    const currentTime = current.updated_at ?? current.submitted_at ?? ""
    const nextTime = submission.updated_at ?? submission.submitted_at ?? ""

    if (nextTime > currentTime) {
      submissionMap.set(submission.producer_id, submission)
    }
  }

  const rows = (producers ?? [])
    .filter((producer) => {
      const status = submissionMap.get(producer.id)?.status ?? "未提出"
      return status === "未提出"
    })
    .map((producer) => [producer.producer_name])

  const header = ["生産者名"]
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unsubmitted_producers.csv"',
    },
  })
}