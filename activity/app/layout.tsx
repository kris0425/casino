import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "橫濱改裝工坊｜澳門最大賭場",
  description: "Discord 賭場 Bot 的互動式車輛改裝預覽原型。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
