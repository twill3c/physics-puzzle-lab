"use client";

import type { ToolKind } from "@/types/physics";
import { TOOL_KINDS } from "@/types/physics";

const LABEL: Record<ToolKind, string> = {
  board: "BOARD",
  block: "BLOCK",
  spring: "SPRING",
  fan: "FAN",
};

const DESC: Record<ToolKind, string> = {
  board: "板。傾けて坂にする",
  block: "箱。重さで押す",
  spring: "ばね。引き寄せる",
  fan: "送風。押し続ける",
};

interface Props {
  limits: Record<ToolKind, number>;
  remaining: Record<ToolKind, number>;
  active: ToolKind | null;
  onSelect: (kind: ToolKind | null) => void;
  disabled: boolean;
}

/**
 * Tool Palette。原仕様 §19。
 *
 * 個数 0 の道具は**出さない**。押せない物を並べておくより、その面で使える物だけを
 * 見せるほうが分かりやすい。残数は数字で出す —— 色や濃さだけで残りを表すと、
 * 「あと何個置けるか」が読み取れない(SPEC N-06)。
 */
export default function ToolPalette({ limits, remaining, active, onSelect, disabled }: Props) {
  const available = TOOL_KINDS.filter((k) => limits[k] > 0);

  if (available.length === 0) {
    return <p className="palette__empty">この面では部品を使わない。</p>;
  }

  return (
    <ul className="palette" aria-label="部品パレット">
      {available.map((kind) => {
        const left = remaining[kind];
        const soldOut = left <= 0;
        const isActive = active === kind;

        return (
          <li key={kind}>
            <button
              type="button"
              className={`palette__item${isActive ? " palette__item--active" : ""}`}
              onClick={() => onSelect(isActive ? null : kind)}
              disabled={disabled || soldOut}
              aria-pressed={isActive}
              aria-label={`${LABEL[kind]} 残り ${left} 個。${DESC[kind]}`}
            >
              <span className="palette__label">{LABEL[kind]}</span>
              <span className="palette__count">
                {left} / {limits[kind]}
              </span>
              <span className="palette__desc">{DESC[kind]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
