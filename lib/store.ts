import { promises as fs } from "fs";
import * as path from "path";
import { DrawResult, Ticket } from "./types";
import { mockDraws } from "./mockData";
import officialDrawsSnapshot from "../data/officialDraws.json";
import { fetchOfficialDltDraws } from "./officialDltApi";
import { getSupabaseAdmin, hasSupabaseEnv } from "./supabase";
import { getSupabasePgPool, hasSupabasePgEnv, pgDrawToValues, pgRowToDraw, pgRowToTicket } from "./supabasePg";

const dataDir = path.join(process.cwd(), "data");
const ticketPath = path.join(dataDir, "tickets.json");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function rowToDraw(row: any): DrawResult {
  return {
    drawNo: row.draw_no,
    date: row.draw_date,
    numbers: { front: row.front, back: row.back },
    pool: row.pool ?? undefined,
    source: row.source === "api" ? "api" : "mock",
  };
}

function drawToRow(draw: DrawResult) {
  return {
    draw_no: draw.drawNo,
    draw_date: draw.date,
    front: draw.numbers.front,
    back: draw.numbers.back,
    pool: draw.pool ?? null,
    source: draw.source,
    raw: draw,
    updated_at: new Date().toISOString(),
  };
}

function rowToTicket(row: any): Ticket {
  return {
    id: row.id,
    createdAt: row.created_at,
    drawNo: row.draw_no,
    budget: Number(row.budget),
    totalCost: Number(row.total_cost),
    lines: row.lines || [],
    status: row.status,
    note: row.note || "",
  };
}

function ticketToRow(ticket: Ticket) {
  return {
    id: ticket.id,
    created_at: ticket.createdAt,
    draw_no: ticket.drawNo,
    budget: ticket.budget,
    total_cost: ticket.totalCost,
    lines: ticket.lines,
    status: ticket.status,
    note: ticket.note || null,
  };
}

export async function syncOfficialDraws(pageSize = 30): Promise<DrawResult[]> {
  const draws = await fetchOfficialDltDraws(pageSize);

  const pgPool = getSupabasePgPool();
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query("begin");
      for (const draw of draws) {
        await client.query(
          `insert into public.draws (draw_no, draw_date, front, back, pool, source, raw, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, now())
           on conflict (draw_no) do update set
             draw_date = excluded.draw_date,
             front = excluded.front,
             back = excluded.back,
             pool = excluded.pool,
             source = excluded.source,
             raw = excluded.raw,
             updated_at = now()`,
          pgDrawToValues(draw),
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    return draws;
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("draws").upsert(draws.map(drawToRow), { onConflict: "draw_no" });
    if (error) throw new Error(`Supabase draws upsert failed: ${error.message}`);
  }
  return draws;
}

export async function getDraws(): Promise<DrawResult[]> {
  const pgPool = getSupabasePgPool();
  if (pgPool) {
    const { rows } = await pgPool.query(
      "select draw_no, draw_date, front, back, pool, source from public.draws order by draw_date desc limit 50",
    );
    if (rows.length) return rows.map(pgRowToDraw);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("draws")
      .select("draw_no,draw_date,front,back,pool,source")
      .order("draw_date", { ascending: false })
      .limit(50);
    if (!error && data && data.length) return data.map(rowToDraw);
  }

  try {
    const liveDraws = await syncOfficialDraws(30);
    if (liveDraws.length) return liveDraws;
  } catch (error) {
    console.warn("Official DLT API unavailable, falling back to official snapshot", error);
  }

  if ((officialDrawsSnapshot as DrawResult[]).length) return officialDrawsSnapshot as DrawResult[];

  return mockDraws;
}

export async function getTickets(): Promise<Ticket[]> {
  const pgPool = getSupabasePgPool();
  if (pgPool) {
    const { rows } = await pgPool.query(
      "select id, created_at, draw_no, budget, total_cost, lines, status, note from public.tickets order by created_at desc limit 200",
    );
    return rows.map(pgRowToTicket);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("tickets")
      .select("id,created_at,draw_no,budget,total_cost,lines,status,note")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Supabase tickets select failed: ${error.message}`);
    return (data || []).map(rowToTicket);
  }

  await ensureDataDir();
  try {
    const raw = await fs.readFile(ticketPath, "utf8");
    return JSON.parse(raw) as Ticket[];
  } catch {
    return [];
  }
}

export async function saveTicket(ticket: Ticket) {
  const pgPool = getSupabasePgPool();
  if (pgPool) {
    const { rows } = await pgPool.query(
      `insert into public.tickets (id, created_at, draw_no, budget, total_cost, lines, status, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, created_at, draw_no, budget, total_cost, lines, status, note`,
      [ticket.id, ticket.createdAt, ticket.drawNo, ticket.budget, ticket.totalCost, JSON.stringify(ticket.lines), ticket.status, ticket.note || null],
    );
    return pgRowToTicket(rows[0]);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("tickets")
      .insert(ticketToRow(ticket))
      .select("id,created_at,draw_no,budget,total_cost,lines,status,note")
      .single();
    if (error) throw new Error(`Supabase ticket insert failed: ${error.message}`);
    return rowToTicket(data);
  }

  await ensureDataDir();
  const tickets = await getTickets();
  tickets.unshift(ticket);
  await fs.writeFile(ticketPath, JSON.stringify(tickets, null, 2), "utf8");
  return ticket;
}

export function dataBackendLabel() {
  if (hasSupabasePgEnv()) return "supabase-postgres";
  if (hasSupabaseEnv()) return "supabase-js";
  return "local-json";
}
