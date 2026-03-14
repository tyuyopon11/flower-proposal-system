import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEntryUrl } from "../../../../lib/app-url";

type Producer = {
  id: string;
  producer_name: string;
};

type ProducerLink = {
  producer_id: string;
  token: string;
  is_active: boolean | null;
  created_at: string | null;
};

export async function GET() {
  const supabase = await createClient();

  const { data: producers, error: producersError } = await supabase
    .from("producers")
    .select("id, producer_name")
    .order("producer_name", { ascending: true });

  if (producersError) {
    return NextResponse.json(
      { error: `producers取得失敗: ${producersError.message}` },
      { status: 500 }
    );
  }

  const producerList = (producers ?? []) as Producer[];
  const producerIds = producerList.map((producer) => producer.id);

  let links: ProducerLink[] = [];

  if (producerIds.length > 0) {
    const { data: linksData, error: linksError } = await supabase
      .from("producer_links")
      .select("producer_id, token, is_active, created_at")
      .in("producer_id", producerIds)
      .order("created_at", { ascending: false });

    if (linksError) {
      return NextResponse.json(
        { error: `producer_links取得失敗: ${linksError.message}` },
        { status: 500 }
      );
    }

    links = (linksData ?? []) as ProducerLink[];
  }

  const latestLinkMap = new Map<string, ProducerLink>();

  for (const link of links) {
    if (!latestLinkMap.has(link.producer_id)) {
      latestLinkMap.set(link.producer_id, link);
    }
  }

  const rows = producerList.map((producer) => {
    const link = latestLinkMap.get(producer.id);

    return {
      producer_name: producer.producer_name,
      token: link?.token ?? "",
      is_active: link?.is_active ?? false,
      entry_url: link?.token ? buildEntryUrl(link.token) : "",
    };
  });

  const header = ["生産者名", "token", "有効", "入力URL"];
  const body = rows.map((row) => [
    row.producer_name,
    row.token,
    row.is_active ? "TRUE" : "FALSE",
    row.entry_url,
  ]);

  const csv = [header, ...body]
    .map((line) =>
      line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    )
    .join("\r\n");

  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="producer-urls.csv"',
    },
  });
}