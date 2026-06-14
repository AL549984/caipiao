import { NextResponse } from "next/server";
import { checkTicket } from "@/lib/dlt";
import { getDraws, getTickets } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json();
  const tickets = await getTickets();
  const draws = await getDraws();
  const ticket = tickets.find((t) => t.id === body.ticketId) || body.ticket;
  if (!ticket) return NextResponse.json({ error: "ticket not found" }, { status: 404 });
  const draw = draws.find((d) => d.drawNo === ticket.drawNo);
  return NextResponse.json(checkTicket(ticket, draw));
}
