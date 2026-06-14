import { Pool } from "pg";
import { DrawResult, Ticket } from "./types";

let pool: Pool | null = null;

export function hasSupabasePgEnv() {
  return Boolean(process.env.SUPABASE_DB_URL);
}

export function getSupabasePgPool() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

export function pgRowToDraw(row: any): DrawResult {
  return {
    drawNo: row.draw_no,
    date: row.draw_date instanceof Date ? row.draw_date.toISOString().slice(0, 10) : String(row.draw_date),
    numbers: { front: row.front, back: row.back },
    pool: row.pool == null ? undefined : Number(row.pool),
    source: row.source === "api" ? "api" : "mock",
  };
}

export function pgDrawToValues(draw: DrawResult) {
  return [draw.drawNo, draw.date, draw.numbers.front, draw.numbers.back, draw.pool ?? null, draw.source, draw];
}

export function pgRowToTicket(row: any): Ticket {
  return {
    id: row.id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    drawNo: row.draw_no,
    budget: Number(row.budget),
    totalCost: Number(row.total_cost),
    lines: row.lines || [],
    status: row.status,
    note: row.note || "",
  };
}
