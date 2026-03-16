import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEntryUrl } from "@/lib/app-url";

function normalizeProducerName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const producerName = normalizeProducerName(body?.producer_name);

    if (!producerName) {
      return NextResponse.json(
        { error: "生産者名は必須です" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: existingProducer, error: existingError } = await supabase
      .from("producers")
      .select("id, producer_name")
      .eq("producer_name", producerName)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: `重複確認に失敗しました: ${existingError.message}` },
        { status: 500 }
      );
    }

    if (existingProducer) {
      return NextResponse.json(
        { error: "同名の生産者が既に存在します" },
        { status: 409 }
      );
    }

    const { data: producer, error: producerError } = await supabase
      .from("producers")
      .insert({ producer_name: producerName })
      .select("id, producer_name")
      .single();

    if (producerError) {
      return NextResponse.json(
        { error: `生産者登録に失敗しました: ${producerError.message}` },
        { status: 500 }
      );
    }

    const token = randomUUID().replace(/-/g, "");

    const { error: linkError } = await supabase.from("producer_links").insert({
      producer_id: producer.id,
      token,
      is_active: true,
    });

    if (linkError) {
      await supabase.from("producers").delete().eq("id", producer.id);

      return NextResponse.json(
        { error: `入力URL発行に失敗しました: ${linkError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "生産者を登録しました",
        producer: {
          id: producer.id,
          producer_name: producer.producer_name,
        },
        token,
        entry_url: buildEntryUrl(token),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "不正なリクエストです" },
      { status: 400 }
    );
  }
}