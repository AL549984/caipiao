import { NextResponse } from "next/server";
import { generatePlan } from "@/lib/dlt";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const plan = generatePlan({
    budget: Number(body.budget || 100),
    drawNo: body.drawNo,
    strategy: body.strategy === "cap-first" ? "cap-first" : "balanced",
    seed: body.seed,
  });
  return NextResponse.json(plan);
}
