import type { Metadata } from "next";
import Link from "next/link";

import StageSelector from "@/components/StageSelector";

export const metadata: Metadata = {
  title: "ステージ一覧 — Physics Puzzle Lab",
  description: "20 面の物理パズル。クリアすると次の面が開く。",
};

export default function StagesPage() {
  return (
    <main className="wrap">
      <h1>ステージ一覧</h1>
      <p className="sub">
        クリアすると次の面が開く。進捗はこのブラウザの中にだけ保存される。
      </p>

      <StageSelector />

      <p className="muted" style={{ marginTop: "1.5rem" }}>
        <Link href="/">← ホームへ</Link>
      </p>
    </main>
  );
}
