import { NextResponse } from "next/server";
import { getTickets, saveTicket } from "@/lib/store";
import { Ticket } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getTickets());
}

function isValidTicketBody(body: any) {
  return Boolean(
    body &&
    typeof body.drawNo === "string" &&
    Number.isFinite(Number(body.budget)) &&
    Number.isFinite(Number(body.totalCost)) &&
    Array.isArray(body.lines) &&
    body.lines.length > 0,
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isValidTicketBody(body)) {
    return NextResponse.json({ error: "invalid ticket payload" }, { status: 400 });
  }

  const ticket: Ticket = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    drawNo: body.drawNo,
    budget: Number(body.budget),
    totalCost: Number(body.totalCost),
    lines: body.lines,
    status: body.status || "planned",
    note: body.note || "",
  };

  try {
    return NextResponse.json(await saveTicket(ticket));
  } catch (error) {
    return NextResponse.json(
      { error: "ticket persistence unavailable", detail: error instanceof Error ? error.message : String(error), ticket },
      { status: 503 },
    );
  }
}
