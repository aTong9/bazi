import type { Metadata } from "next";
import { BaziWorkbench } from "./BaziWorkbench";

export const metadata: Metadata = {
  title: "见字 · 四柱关系实验室",
  description: "从出生时空生成可追溯的四柱、关系结构与流年提示。",
};

export default function Home() {
  return <BaziWorkbench />;
}
