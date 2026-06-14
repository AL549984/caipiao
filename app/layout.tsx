import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大乐透理性决策工作台",
  description: "个人购彩计划记录、历史开奖追踪与兑奖复盘工具",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
