"use client";

import type { GameStatus } from "@/types/game";
import { TIME_SCALES } from "@/lib/constants";

interface Props {
  status: GameStatus;
  timeScale: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onCycleSpeed: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const SPEED_LABEL: Record<number, string> = {
  [TIME_SCALES.normal]: "1.0x",
  [TIME_SCALES.slow]: "0.5x",
  [TIME_SCALES.ultraSlow]: "0.25x",
};

/**
 * 操作バー。原仕様 §9 / §28 / §29 / §45。
 *
 * 状態は**文字でも**出す(SPEC N-06: 色だけで状態を表さない)。
 * ボタンは 44px 以上の高さを CSS で確保する(原仕様 §46)。
 */
export default function GameToolbar({
  status,
  timeScale,
  onStart,
  onPause,
  onReset,
  onCycleSpeed,
  onDelete,
  canDelete,
}: Props) {
  const running = status === "RUNNING";
  const settled = status === "CLEAR" || status === "FAILED";

  return (
    <div className="toolbar" role="group" aria-label="操作">
      <button
        type="button"
        className="toolbar__btn toolbar__btn--primary"
        onClick={running ? onPause : onStart}
        disabled={settled}
      >
        {running ? "Pause" : status === "PAUSED" ? "Resume" : "Start"}
        <kbd className="toolbar__key">Space</kbd>
      </button>

      <button type="button" className="toolbar__btn" onClick={onReset}>
        Reset
        <kbd className="toolbar__key">R</kbd>
      </button>

      <button
        type="button"
        className="toolbar__btn"
        onClick={onCycleSpeed}
        aria-label={`再生速度 ${SPEED_LABEL[timeScale] ?? "1.0x"}。押すと切り替わる`}
      >
        Slow {SPEED_LABEL[timeScale] ?? "1.0x"}
        <kbd className="toolbar__key">S</kbd>
      </button>

      <button type="button" className="toolbar__btn" onClick={onDelete} disabled={!canDelete}>
        Delete
        <kbd className="toolbar__key">Del</kbd>
      </button>

      <span className="toolbar__status" role="status">
        {statusLabel(status)}
      </span>
    </div>
  );
}

function statusLabel(status: GameStatus): string {
  switch (status) {
    case "READY":
      return "部品を置いて Start";
    case "EDITING":
      return "編集中";
    case "RUNNING":
      return "実行中";
    case "PAUSED":
      return "一時停止";
    case "CLEAR":
      return "クリア";
    case "FAILED":
      return "失敗 — Reset でやり直し";
  }
}
