import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();

  const producerName = body.producer_name;

  const { data: producer } = await supabase
    .from("producers")
    .insert({
      producer_name: producerName,
    })
    .select()
    .single();

  const token = crypto.randomBytes(16).toString("hex");

  await supabase.from("producer_links").insert({
    producer_id: producer.id,
    token,
  });

  return NextResponse.json({
    success: true,
  });
}