import { execFile } from "child_process";
import { promisify } from "util";
import { DrawResult } from "./types";

const execFileAsync = promisify(execFile);
const OFFICIAL_DLT_URL = "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry";

type OfficialDraw = {
  lotteryDrawNum: string;
  lotteryDrawResult: string;
  lotteryDrawTime: string;
  poolBalanceAfterdraw?: string;
};

type OfficialResponse = {
  errorCode?: string;
  errorMessage?: string;
  success?: boolean;
  value?: {
    lastPoolDraw?: OfficialDraw;
    list?: OfficialDraw[];
  };
};

function parseMoney(input?: string) {
  if (!input) return undefined;
  const normalized = input.replace(/,/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value) : undefined;
}

function parseNumbers(raw: string) {
  const parts = raw.split(/\s+/).map((n) => Number(n)).filter(Number.isFinite);
  if (parts.length < 7) throw new Error(`官方开奖号码格式异常: ${raw}`);
  return { front: parts.slice(0, 5), back: parts.slice(5, 7) };
}

function normalizeDraw(item: OfficialDraw): DrawResult {
  return {
    drawNo: item.lotteryDrawNum,
    date: item.lotteryDrawTime,
    numbers: parseNumbers(item.lotteryDrawResult),
    pool: parseMoney(item.poolBalanceAfterdraw),
    source: "api",
  };
}

function buildUrl(pageSize: number) {
  const params = new URLSearchParams({
    gameNo: "85",
    provinceId: "0",
    pageSize: String(pageSize),
    isVerify: "1",
    pageNo: "1",
  });
  return `${OFFICIAL_DLT_URL}?${params.toString()}`;
}

function parseOfficialPayload(text: string) {
  const data = JSON.parse(text) as OfficialResponse;
  if (data.errorCode !== "0" || !data.value) {
    throw new Error(`官方开奖接口返回异常: ${data.errorMessage || data.errorCode || "unknown"}`);
  }
  const list = data.value.list?.length ? data.value.list : data.value.lastPoolDraw ? [data.value.lastPoolDraw] : [];
  return list.map(normalizeDraw);
}

async function fetchViaNode(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Referer": "https://www.lottery.gov.cn/kj/kjlb.html?dlt=",
      "Origin": "https://www.lottery.gov.cn",
      "Accept": "application/json,text/plain,*/*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`官方开奖接口 HTTP ${res.status}`);
  return res.text();
}

async function fetchViaCurl(url: string) {
  const { stdout } = await execFileAsync("curl", [
    "-L",
    "--max-time",
    "25",
    url,
    "-H",
    "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "-H",
    "Referer: https://www.lottery.gov.cn/kj/kjlb.html?dlt=",
    "-H",
    "Origin: https://www.lottery.gov.cn",
    "-H",
    "Accept: application/json,text/plain,*/*",
  ], { maxBuffer: 1024 * 1024 });
  return stdout;
}

export async function fetchOfficialDltDraws(pageSize = 30): Promise<DrawResult[]> {
  const url = buildUrl(pageSize);
  try {
    return parseOfficialPayload(await fetchViaNode(url));
  } catch (nodeError) {
    try {
      return parseOfficialPayload(await fetchViaCurl(url));
    } catch (curlError) {
      const nodeMessage = nodeError instanceof Error ? nodeError.message : String(nodeError);
      const curlMessage = curlError instanceof Error ? curlError.message : String(curlError);
      throw new Error(`官方开奖接口不可用: node=${nodeMessage}; curl=${curlMessage}`);
    }
  }
}
