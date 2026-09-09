"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import GameScreen from "@/components/GameScreen";
import { stageCount } from "@/game/stageManager";

/**
 * ゲーム画面。`/game?stage=N` で面を選ぶ。
 *
 * 範囲外の指定は 1 面目へ丸める —— 存在しない面で落とすより、
 * 遊べる状態にして案内するほうがよい(原仕様 §56 のエラー方針)。
 */
function GameRoute() {
  const params = useSearchParams();
  const raw = Number(params.get("stage") ?? "1");
  const id = Number.isInteger(raw) && raw >= 1 && raw <= stageCount() ? raw : 1;

  return <GameScreen key={id} stageId={id} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<main className="wrap"><p>読み込み中…</p></main>}>
      <GameRoute />
    </Suspense>
  );
}
