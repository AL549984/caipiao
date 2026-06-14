export type DltNumbers = {
  front: number[];
  back: number[];
};

export type DltLine = DltNumbers & {
  id: string;
  label: string;
  role: "main" | "coverage";
  multiplier: number;
  addOn: boolean;
  cost: number;
  rationale: string;
};

export type Plan = {
  drawNo: string;
  date: string;
  budget: number;
  strategy: "cap-first" | "balanced";
  lines: DltLine[];
  totalCost: number;
  remainder: number;
  assumptions: string[];
  riskNotes: string[];
};

export type DrawResult = {
  drawNo: string;
  date: string;
  numbers: DltNumbers;
  pool?: number;
  source: "mock" | "api";
};

export type Ticket = {
  id: string;
  createdAt: string;
  drawNo: string;
  budget: number;
  totalCost: number;
  lines: DltLine[];
  status: "planned" | "bought" | "checked";
  note?: string;
};

export type PrizeCheck = {
  ticketId?: string;
  drawNo: string;
  checkedAt: string;
  result?: DrawResult;
  lineResults: Array<{
    lineId: string;
    label: string;
    frontHits: number;
    backHits: number;
    matchedFront: number[];
    matchedBack: number[];
    multiplier: number;
    addOn: boolean;
    tier: string;
  }>;
  summary: string;
};
