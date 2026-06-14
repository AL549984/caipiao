# 大乐透每日购彩决策与追踪网站

一个完整 Next.js 全栈 MVP：每日工作台、方案生成、计划记录、历史开奖 mock/API 预留、兑奖核对、复盘统计、合规提示。

## 启动

```bash
cd /Users/yueyue/Downloads/dlt-decision-tracker
npm install
npm run dev
```

打开 http://localhost:3000

## 已实现

- 首页即工作台，不是营销页。
- 方案生成 API：`POST /api/plans/generate`
- 历史开奖 API：`GET /api/draws`
- 计划记录 API：`GET/POST /api/tickets`
- 兑奖核对 API：`POST /api/verify`
- 可替换 mock 数据层：`lib/store.ts` + `data/*.json`
- 风险提示：不承诺中奖率，不暗示稳赚；预算和追加规则显式展示。

## 设计原则

- 不是“预测中奖”产品，而是“记录、预算、追踪、复盘”产品。
- 号码选择本身不宣称概率优势。
- 方案生成只把输入方法论转成预算分配与可追溯记录。

## 真实开奖 API

已接入中国体彩网官方 sporttery 接口：

`https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=30&isVerify=1&pageNo=1`

调用链：

- `GET /api/draws`：优先读 Supabase `draws`，无数据则拉官方接口，失败再回退 mock。
- `POST /api/draws/sync`：手动同步最近 50 期官方开奖到 Supabase；未配置 Supabase 时只返回官方数据。

## Supabase 接入

1. 在 Supabase SQL Editor 执行：`supabase/migrations/001_init.sql`
2. 复制 `.env.example` 为 `.env.local`，填入：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 重启服务：`npm run dev`
4. 调用 `POST /api/draws/sync` 同步官方开奖数据。

注意：当前 MVP 是个人服务端应用，浏览器不直接读写 Supabase。RLS 已开启但未开放 anon policy，Next.js API 使用 service role 访问，避免公开票据记录。
