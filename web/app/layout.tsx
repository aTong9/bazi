import type { Metadata } from "next";
import "./globals.css";

const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: "见字 · 四柱关系实验室",
  description: "八字不是命运判决书，而是看见关系惯性的另一种方式。",
  openGraph: {
    title: "见字 · 四柱关系实验室",
    description: "从出生时空生成可追溯的四柱、大运与流年关系。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "见字 · 四柱关系实验室" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
