import { DltLine, DltNumbers, Plan, PrizeCheck, Ticket, DrawResult } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
export const formatNumbers = (n: DltNumbers) => `${n.front.map(pad).join(" ")} + ${n.back.map(pad).join(" ")}`;

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return ((s >>> 0) / 4294967296);
  };
}

function pick(count: number, max: number, rand: () => number) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

export function generateNumbers(seedText: string): DltNumbers {
  const r = rng(hashSeed(seedText));
  return { front: pick(5, 35, r), back: pick(2, 12, r) };
}

function numberKey(numbers: DltNumbers) {
  return `${numbers.front.join("-")}+${numbers.back.join("-")}`;
}

function generateUniqueNumbers(seed: string, used: Set<string>, label: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const numbers = generateNumbers(`${seed}-${label}-${attempt}`);
    const key = numberKey(numbers);
    if (!used.has(key)) {
      used.add(key);
      return numbers;
    }
  }
  const fallback = generateNumbers(`${seed}-${label}-${Date.now()}`);
  used.add(numberKey(fallback));
  return fallback;
}

export function lineCost(multiplier: number, addOn: boolean) {
  return multiplier * (addOn ? 3 : 2);
}

export function nextDrawNo(date = new Date()) {
  const y = date.getFullYear();
  const start = new Date(y, 0, 1);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
  return `${y}${String(Math.ceil(day / 2)).padStart(3, "0")}`;
}

function chooseCapFirstSplits(budget: number) {
  const preferred = [10, 5, 5, 13];
  const splits: number[] = [];
  let remaining = budget;
  for (const multiplier of preferred) {
    const cost = lineCost(multiplier, true);
    if (remaining >= cost) {
      splits.push(multiplier);
      remaining -= cost;
    }
  }
  if (!splits.length && remaining >= 3) splits.push(Math.floor(remaining / 3));
  return splits.filter((m) => m > 0);
}

export function generatePlan(input?: { budget?: number; drawNo?: string; strategy?: "cap-first" | "balanced"; seed?: string }): Plan {
  const budget = Math.max(20, Math.min(999, Math.floor(input?.budget ?? 100)));
  const drawNo = input?.drawNo || nextDrawNo();
  const strategy = input?.strategy || "balanced";
  const seed = input?.seed || `${drawNo}-${new Date().toISOString().slice(0, 10)}`;
  const lines: DltLine[] = [];
  const used = new Set<string>();

  const push = (partial: Omit<DltLine, "cost">) => lines.push({ ...partial, cost: lineCost(partial.multiplier, partial.addOn) });

  if (strategy === "cap-first") {
    const main = generateUniqueNumbers(seed, used, "cap-main");
    const splits = chooseCapFirstSplits(budget);
    splits.forEach((m, i) => push({
      id: `main-${i + 1}`,
      label: `同号主票 ${i + 1}`,
      role: "main",
      ...main,
      multiplier: m,
      addOn: true,
      rationale: i === 0 ? "同号多倍策略：优先把预算集中到一组号码；只在明确选择冲封顶时使用。" : "同号拆票记录：便于实际出票和后续复盘，不代表提升中奖概率。",
    }));
  } else {
    // Balanced mode must diversify numbers. Each displayed row is a different
    // single-line ticket, instead of repeating the same main number three times.
    let remaining = budget;
    let idx = 1;
    while (remaining >= 2) {
      const addOn = remaining >= 3 && idx <= Math.ceil(budget / 6);
      const cost = addOn ? 3 : 2;
      if (remaining < cost) break;
      const role: DltLine["role"] = idx <= 3 ? "main" : "coverage";
      push({
        id: `${role}-${idx}`,
        label: role === "main" ? `分散主票 ${idx}` : `覆盖号 ${idx - 3}`,
        role,
        ...generateUniqueNumbers(seed, used, `balanced-${idx}`),
        multiplier: 1,
        addOn,
        rationale: role === "main"
          ? "均衡策略：主票之间强制使用不同号码，避免重复占用预算。"
          : addOn
            ? "追加覆盖号：在剩余预算内保留追加资格。"
            : "基础覆盖号：不宣称提升概率，只扩大不同号码覆盖面。",
      });
      remaining -= cost;
      idx += 1;
    }
  }

  const totalCost = lines.reduce((s, l) => s + l.cost, 0);
  return {
    drawNo,
    date: new Date().toISOString(),
    budget,
    strategy,
    lines,
    totalCost,
    remainder: budget - totalCost,
    assumptions: [
      "本工具只做预算分配、记录和复盘，不预测中奖号码。",
      "大乐透每注基础 2 元，追加每注加 1 元；多倍按单注成本乘倍数计算。",
      "均衡策略会强制不同票面号码，避免多行推荐重复占用预算。",
    ],
    riskNotes: [
      "号码组合不代表更高中奖概率；热号、冷号、生日号与机选在数学上没有确定优势。",
      "请只记录自己已决定投入的预算，不因工具推荐而加码。",
      "兑奖结果以后续官方开奖与票面信息为准。",
    ],
  };
}

function hits(line: DltNumbers, draw: DltNumbers) {
  const matchedFront = line.front.filter((n) => draw.front.includes(n));
  const matchedBack = line.back.filter((n) => draw.back.includes(n));
  return { matchedFront, matchedBack, frontHits: matchedFront.length, backHits: matchedBack.length };
}

export function prizeTier(frontHits: number, backHits: number) {
  if (frontHits === 5 && backHits === 2) return "一等奖";
  if (frontHits === 5 && backHits === 1) return "二等奖";
  if (frontHits === 5 && backHits === 0) return "三等奖";
  if (frontHits === 4 && backHits === 2) return "四等奖";
  if ((frontHits === 4 && backHits === 1) || (frontHits === 3 && backHits === 2)) return "五等奖";
  if ((frontHits === 4 && backHits === 0) || (frontHits === 3 && backHits === 1) || (frontHits === 2 && backHits === 2)) return "六等奖";
  if ((frontHits === 3 && backHits === 0) || (frontHits === 2 && backHits === 1) || (frontHits === 1 && backHits === 2) || (frontHits === 0 && backHits === 2)) return "末等奖/需按官方规则复核";
  return "未中奖";
}

export function checkTicket(ticket: Ticket, draw?: DrawResult): PrizeCheck {
  const checkedAt = new Date().toISOString();
  if (!draw) {
    return { ticketId: ticket.id, drawNo: ticket.drawNo, checkedAt, lineResults: [], summary: "尚未找到本期开奖记录，已加入待核验。" };
  }
  const lineResults = ticket.lines.map((line) => {
    const h = hits(line, draw.numbers);
    return { lineId: line.id, label: line.label, ...h, multiplier: line.multiplier, addOn: line.addOn, tier: prizeTier(h.frontHits, h.backHits) };
  });
  const winners = lineResults.filter((l) => l.tier !== "未中奖").length;
  return { ticketId: ticket.id, drawNo: ticket.drawNo, checkedAt, result: draw, lineResults, summary: winners ? `${winners} 注有命中档位，请按官方奖金表和票面信息复核。` : "未命中奖项，保留记录用于复盘。" };
}
