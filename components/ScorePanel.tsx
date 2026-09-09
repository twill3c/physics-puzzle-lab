"use client";

import type { GameStatus, ScoreBreakdown } from "@/types/game";

interface Props {
  status: GameStatus;
  elapsedTicks: number;
  usedObjects: number;
  resetCount: number;
  score: ScoreBreakdown | null;
  bestScore: number | null;
}

/**
 * 成績の表示。原仕様 §25。
 *
 *   CLEAR TIME / OBJECTS USED / RESET COUNT / BEST SCORE / PHYSICS SCORE
 *
 * ランクは**文字で出す**。色だけで GOLD / SILVER を分けると、
 * 色が見分けにくい環境で読み取れない(SPEC N-06)。
 */
export default function ScorePanel({
  status,
  elapsedTicks,
  usedObjects,
  resetCount,
  score,
  bestScore,
}: Props) {
  const seconds = (elapsedTicks / 60).toFixed(1);

  return (
    <div className="score">
      <dl className="score__grid">
        <div>
          <dt>CLEAR TIME</dt>
          <dd>{seconds} 秒</dd>
        </div>
        <div>
          <dt>OBJECTS USED</dt>
          <dd>{usedObjects}</dd>
        </div>
        <div>
          <dt>RESET COUNT</dt>
          <dd>{resetCount}</dd>
        </div>
        <div>
          <dt>BEST SCORE</dt>
          <dd>{bestScore ?? "—"}</dd>
        </div>
      </dl>

      {status === "CLEAR" && score && (
        <div className="score__result" role="status">
          <p className="score__rank" data-rank={score.rank}>
            {score.rank}
          </p>
          <p className="score__total">PHYSICS SCORE {score.total}</p>
          <p className="score__detail muted">
            {score.base} − 時間 {score.timePenalty} − 部品 {score.objectPenalty} − リセット{" "}
            {score.resetPenalty}
          </p>
        </div>
      )}

      {status === "FAILED" && (
        <p className="score__result muted" role="status">
          ボールがゴールに留まらなかった。Reset でやり直せる。
        </p>
      )}
    </div>
  );
}
