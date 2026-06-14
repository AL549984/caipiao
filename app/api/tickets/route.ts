import { NextResponse } from "next/server";
import { getTickets, saveTicket } from "@/lib/store";
import { Ticket } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getTickets());
}

export async function POST(req: Request) {
  const body = await req.json();
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
  return NextResponse.json(await saveTicket(ticket));
}
