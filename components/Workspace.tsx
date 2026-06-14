"use client";

import { useMemo, useState, useTransition } from "react";
import { DrawResult, Plan, PrizeCheck, Ticket } from "@/lib/types";
import { formatNumbers } from "@/lib/dlt";

type Props = {
  initialDraws: DrawResult[];
  initialTickets: Ticket[];
  initialPlan: Plan;
};

const tabs = [
  { id: "plan", label: "每日方案" },
  { id: "tickets", label: "计划记录" },
  { id: "draws", label: "历史开奖" },
  { id: "review", label: "兑奖复盘" },
  { id: "settings", label: "API 设置" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function currency(n: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(n);
}

function Ball({ value, kind }: { value: number; kind: "front" | "back" }) {
  return <span className={`ball ${kind}`}>{String(value).padStart(2, "0")}</span>;
}

function NumberStrip({ front, back }: { front: number[]; back: number[] }) {
  return (
    <div className="number-strip">
      {front.map((n) => <Ball key={`f-${n}`} value={n} kind="front" />)}
      <span className="number-plus">+</span>
      {back.map((n) => <Ball key={`b-${n}`} value={n} kind="back" />)}
    </div>
  );
}

export default function Workspace({ initialDraws, initialTickets, initialPlan }: Props) {
  const [active, setActive] = useState<TabId>("plan");
  const [plan, setPlan] = useState(initialPlan);
  const [tickets, setTickets] = useState(initialTickets);
  const [budget, setBudget] = useState(initialPlan.budget);
  const [strategy, setStrategy] = useState<"balanced" | "cap-first">("balanced");
  const [check, setCheck] = useState<PrizeCheck | null>(null);
  const [isPending, startTransition] = useTransition();

  const kpi = useMemo(() => {
    const spent = tickets.reduce((s, t) => s + t.totalCost, 0);
    return {
      tickets: tickets.length,
      spent,
      checked: tickets.filter((t) => t.status === "checked").length,
      mockDraws: initialDraws.length,
    };
  }, [tickets, initialDraws.length]);

  const regenerate = () => startTransition(async () => {
    const res = await fetch("/api/plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget, strategy, seed: `${Date.now()}` }),
    });
    setPlan(await res.json());
  });

  const savePlan = () => startTransition(async () => {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...plan, status: "planned", note: "由工作台生成，待线下确认是否已购。" }),
    });
    const ticket = await res.json();
    setTickets([ticket, ...tickets]);
    setActive("tickets");
  });

  const verifyTicket = (ticket: Ticket) => startTransition(async () => {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    setCheck(await res.json());
    setActive("review");
  });

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">DLT Decision Tracker · 理性记录工具</p>
          <h1>每日购彩决策与追踪工作台</h1>
          <p className="lede">把“同号追加冲封顶 + 剩余预算覆盖”的方法转成可执行计划；记录下单、同步开奖、核验兑奖、复盘预算。这里不预测中奖，只让每一步可追溯。</p>
          <div className="hero-actions">
            <button className="primary" onClick={regenerate} disabled={isPending}>{isPending ? "生成中…" : "重新生成今日方案"}</button>
            <button className="secondary" onClick={savePlan} disabled={isPending}>保存为计划记录</button>
          </div>
        </div>
        <div className="hero-card" aria-label="今日策略摘要">
          <div className="hero-card-top">
            <span>第 {plan.drawNo} 期</span>
            <strong>{currency(plan.totalCost)}</strong>
          </div>
          <NumberStrip front={plan.lines[0].front} back={plan.lines[0].back} />
          <div className="split-meter">
            <span style={{ width: `${Math.min(100, (plan.lines.filter(l => l.role === "main").reduce((s, l) => s + l.cost, 0) / Math.max(1, plan.totalCost)) * 100)}%` }} />
          </div>
          <div className="hero-microgrid">
            <div><b>{plan.lines.filter(l => l.role === "main").reduce((s, l) => s + l.multiplier, 0)}</b><small>主号追加倍数</small></div>
            <div><b>{plan.lines.filter(l => l.role === "coverage").length}</b><small>覆盖单式注数</small></div>
            <div><b>{currency(plan.remainder)}</b><small>剩余预算</small></div>
          </div>
        </div>
      </section>

      <section className="kpis">
        <div><span>计划数</span><b>{kpi.tickets}</b></div>
        <div><span>已记录预算</span><b>{currency(kpi.spent)}</b></div>
        <div><span>已核验</span><b>{kpi.checked}</b></div>
        <div><span>开奖源</span><b>{kpi.mockDraws} 期 Mock</b></div>
      </section>

      <nav className="tabs" aria-label="工作台模块">
        {tabs.map((t) => (
          <button key={t.id} className={active === t.id ? "active" : ""} onClick={() => setActive(t.id)}>{t.label}</button>
        ))}
      </nav>

      {active === "plan" && (
        <section className="grid two">
          <div className="panel control-panel">
            <div className="section-heading">
              <p>Plan Generator</p>
              <h2>方案生成</h2>
            </div>
            <label className="field">
              <span>预算上限</span>
              <input type="number" min="20" max="999" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>策略</span>
              <select value={strategy} onChange={(e) => setStrategy(e.target.value as "balanced" | "cap-first")}>
                <option value="balanced">兼顾封顶与覆盖</option>
                <option value="cap-first">纯同号追加冲封顶</option>
              </select>
            </label>
            <button className="primary wide" onClick={regenerate} disabled={isPending}>按当前设置生成</button>
            <div className="notice calm">
              文档中的“13 注追加 + 7 注不追加”在 40 元剩余预算内成本不成立。本 MVP 会自动按预算重新约束，避免生成无法执行的计划。
            </div>
          </div>

          <div className="panel">
            <div className="section-heading inline">
              <div><p>Today's Plan</p><h2>第 {plan.drawNo} 期方案</h2></div>
              <strong>{currency(plan.totalCost)}</strong>
            </div>
            <div className="line-list">
              {plan.lines.map((line) => (
                <article className={`line-card ${line.role}`} key={line.id}>
                  <div className="line-meta">
                    <span>{line.label}</span>
                    <b>{line.multiplier} 倍 · {line.addOn ? "追加" : "不追加"} · {currency(line.cost)}</b>
                  </div>
                  <NumberStrip front={line.front} back={line.back} />
                  <p>{line.rationale}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {active === "tickets" && (
        <section className="panel">
          <div className="section-heading inline">
            <div><p>Orders</p><h2>下单计划记录</h2></div>
            <button className="secondary" onClick={savePlan} disabled={isPending}>保存当前方案</button>
          </div>
          {tickets.length === 0 ? <div className="empty">还没有保存记录。先在“每日方案”里保存一条计划。</div> : (
            <div className="ticket-table">
              {tickets.map((ticket) => (
                <article className="ticket-row" key={ticket.id}>
                  <div>
                    <span className="status-dot" />
                    <b>第 {ticket.drawNo} 期</b>
                    <small>{new Date(ticket.createdAt).toLocaleString("zh-CN")}</small>
                  </div>
                  <div>{ticket.lines.length} 注 / {currency(ticket.totalCost)}</div>
                  <div className="ticket-actions">
                    <button className="ghost" onClick={() => verifyTicket(ticket)}>兑奖核对</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {active === "draws" && (
        <section className="panel">
          <div className="section-heading"><p>Results</p><h2>历史开奖</h2></div>
          <div className="draw-grid">
            {initialDraws.map((draw) => (
              <article className="draw-card" key={draw.drawNo}>
                <div className="draw-head"><b>第 {draw.drawNo} 期</b><span>{draw.date}</span></div>
                <NumberStrip front={draw.numbers.front} back={draw.numbers.back} />
                <p>奖池：{draw.pool ? `${Math.round(draw.pool / 100000000)} 亿级` : "待同步"} · 来源：{draw.source === "mock" ? "Mock，可替换" : "API"}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {active === "review" && (
        <section className="grid two">
          <div className="panel">
            <div className="section-heading"><p>Prize Check</p><h2>兑奖核对</h2></div>
            {tickets.length === 0 ? <div className="empty">暂无可核验票据。</div> : tickets.map((ticket) => (
              <button className="review-button" key={ticket.id} onClick={() => verifyTicket(ticket)}>
                <span>第 {ticket.drawNo} 期</span>
                <b>{formatNumbers(ticket.lines[0])}</b>
              </button>
            ))}
          </div>
          <div className="panel">
            <div className="section-heading"><p>Result</p><h2>核验结果</h2></div>
            {!check ? <div className="empty">选择一条计划后，会在这里显示每注命中前区/后区数量与档位提示。</div> : (
              <div className="check-result">
                <div className="notice">{check.summary}</div>
                {check.lineResults.map((r) => (
                  <div className="result-row" key={r.lineId}>
                    <b>{r.label}</b>
                    <span>前区 {r.frontHits} / 后区 {r.backHits}</span>
                    <strong>{r.tier}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {active === "settings" && (
        <section className="grid two">
          <div className="panel">
            <div className="section-heading"><p>Integration</p><h2>API 与定时任务预留</h2></div>
            <div className="flow-list">
              <div><b>开奖同步</b><span>每日 21:30 后触发 `/api/draws` 同步；真实接口未配置时回退 mock。</span></div>
              <div><b>中奖核验</b><span>开奖入库后批量调用 `/api/verify`，命中结果进入提醒队列。</span></div>
              <div><b>兑奖提醒</b><span>高亮待确认票据，展示“以官方和票面为准”的复核提示。</span></div>
              <div><b>数据存储</b><span>MVP 本地 JSON；生产建议迁移 Supabase，保持 tickets/draws/plan_runs/settings 表结构。</span></div>
            </div>
          </div>
          <div className="panel sober">
            <div className="section-heading"><p>Compliance</p><h2>责任购彩声明</h2></div>
            <p>本网站不提供预测服务，不承诺提高中奖率，不诱导追加预算。所有号码仅用于个人记录和复盘，最终开奖、奖金、兑奖条件以中国体育彩票官方公告和票面信息为准。</p>
            <p>如果你的投注行为已超过原预算或影响生活，请停止使用并寻求身边人的帮助。</p>
          </div>
        </section>
      )}
    </main>
  );
}
