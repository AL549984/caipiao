import { NextResponse } from "next/server";
import { dataBackendLabel, getDraws } from "@/lib/store";

export async function GET() {
  const draws = await getDraws();
  return NextResponse.json({ source: draws[0]?.source || "mock", backend: dataBackendLabel(), draws });
}
