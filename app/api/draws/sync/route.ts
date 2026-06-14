import { NextResponse } from "next/server";
import { syncOfficialDraws, dataBackendLabel } from "@/lib/store";

export async function POST() {
  try {
    const draws = await syncOfficialDraws(50);
    return NextResponse.json({ ok: true, backend: dataBackendLabel(), synced: draws.length, latest: draws[0] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, backend: dataBackendLabel(), error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
