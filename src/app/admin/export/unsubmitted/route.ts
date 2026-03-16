import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Producer = {
  id: string;
  producer_name: string;
};

type Submission = {
  producer_id: string;
  status: string | null;
  updated_at: string | null;
  submitted_at: string | null;
};

export async function GET() {
  const supabase = await createClient();

  const [
    { data: producers, error: producersError },
    { data: submissions, error: submissionsError },
  ] = await Promise.all([
    supabase
      .from("producers")
      .select("id, producer_name")
      .order("producer_name", { ascending: true }),
    supabase
      .from("submissions")
      .select("producer_id, status, updated_at, submitted_at"),
  ]);

  if (producersError) {
    return NextResponse.json({ error: producersError.message }, { status: 500 });
  }

  if (submissionsError) {
    return NextResponse.json(
      { error: submissionsError.message },
      { status: 500 }
    );
  }

  const latestSubmissionMap = new Map<string, Submission>();

  for (const submission of (submissions ?? []) as Submission[]) {
    const current = latestSubmissionMap.get(submission.producer_id);

    if (!current) {
      latestSubmissionMap.set(submission.producer_id, submission);
      continue;
    }

    const currentTime = new Date(
      current.updated_at ?? current.submitted_at ?? 0
    ).getTime();

    const nextTime = new Date(
      submission.updated_at ?? submission.submitted_at ?? 0
    ).getTime();

    if (nextTime >= currentTime) {
      latestSubmissionMap.set(submission.producer_id, submission);
    }
  }

  const rows = ((producers ?? []) as Producer[])
    .filter((producer) => {
      const latest = latestSubmissionMap.get(producer.id);
      return !latest?.status;
    })
    .map((producer) => [producer.producer_name]);

  const header = ["生産者名"];

  const csv = [header, ...rows]
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");

  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unsubmitted_producers.csv"',
    },
  });
}