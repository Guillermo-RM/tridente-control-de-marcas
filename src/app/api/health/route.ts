import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "control-de-rondas", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

