"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { allStages } from "@/game/stageManager";
import { loadSave, stageSelectState } from "@/lib/storage";
import { defaultSave } from "@/lib/storage";
import type { SaveData, StageSelectState } from "@/types/game";

/**
 * ステージ選択。原仕様 §39。
 *
 * 状態は**文字で出す**(GOLD / SILVER / BRONZE / CLEAR / NEW / LOCKED)。
 * 色や枠だけで区別すると、どれが開いているのか読み取れない(SPEC N-06)。
 *
 * 保存内容の読み出しは描画後に行う。サーバ側には LocalStorage が無いので、
 * 最初の描画で読むと server と client で結果が食い違う。
 */
export default function StageSelector() {
  const [save, setSave] = useState<SaveData>(defaultSave);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSave(loadSave());
    setReady(true);
  }, []);

  return (
    <ul className="stages">
      {allStages().map((stage) => {
        const state: StageSelectState = ready
          ? stageSelectState(stage.id, save, stage.score)
          : stage.id === 1
            ? "NEW"
            : "LOCKED";
        const locked = state === "LOCKED";
        const best = save.bestScores[String(stage.id)];

        const card = (
          <>
            <span className="stagecard__no">STAGE {String(stage.id).padStart(2, "0")}</span>
            <span className="stagecard__name">{stage.name}</span>
            <span className="stagecard__theme">{stage.theme}</span>
            <span className="stagecard__state" data-state={state}>
              {state}
              {best !== undefined && <span className="stagecard__best"> {best}</span>}
            </span>
            <span className="stagecard__diff" aria-label={`難易度 ${stage.difficulty}`}>
              {"★".repeat(stage.difficulty)}
              <span className="stagecard__diff-off">{"★".repeat(5 - stage.difficulty)}</span>
            </span>
          </>
        );

        return (
          <li key={stage.id}>
            {locked ? (
              <div className="stagecard stagecard--locked" aria-disabled="true">
                {card}
              </div>
            ) : (
              <Link className="stagecard" href={`/game?stage=${stage.id}`}>
                {card}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
