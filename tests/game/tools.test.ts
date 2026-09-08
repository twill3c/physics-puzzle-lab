import { describe, it, expect } from "vitest";

import { createToolState, canPlace, place, remove, usedCount } from "@/game/toolManager";
import { makeStage } from "../helpers/stage";

/**
 * F-09 — Tool Palette の個数制限。原仕様 §19 / §20(ステージの `tools`)。
 *
 * 期待値の出所: 原仕様 §20 の `tools` は「種別ごとの使用可能個数」であり、
 * 0 はそのツールを使えないことを表す(SPEC types/stage.ts)。
 */

const stage = makeStage({ tools: { board: 2, block: 1, spring: 0, fan: 0 } });

describe("T-029 ツールの個数制限(F-09)", () => {
  it("上限まで置ける", () => {
    let s = createToolState(stage);
    expect(canPlace(s, "board")).toBe(true);
    s = place(s, "board", "p1");
    s = place(s, "board", "p2");
    expect(usedCount(s)).toBe(2);
  });

  it("上限を超えては置けない", () => {
    let s = createToolState(stage);
    s = place(s, "board", "p1");
    s = place(s, "board", "p2");
    expect(canPlace(s, "board")).toBe(false);
    expect(() => place(s, "board", "p3")).toThrow();
  });

  it("個数 0 のツールは最初から置けない", () => {
    const s = createToolState(stage);
    expect(canPlace(s, "spring")).toBe(false);
    expect(canPlace(s, "fan")).toBe(false);
  });

  it("削除すると枠が戻る", () => {
    let s = createToolState(stage);
    s = place(s, "board", "p1");
    s = place(s, "board", "p2");
    expect(canPlace(s, "board")).toBe(false);

    s = remove(s, "p1");
    expect(canPlace(s, "board")).toBe(true);
    expect(usedCount(s)).toBe(1);
  });

  it("使用数はスコアの ObjectPenalty に渡す数と一致する", () => {
    // 原仕様 §23 の usedObjects は「プレイヤーが置いた数」。
    // ステージが最初から置いている固定物は数えない(types/physics.ts の注)。
    let s = createToolState(stage);
    s = place(s, "board", "p1");
    s = place(s, "block", "p2");
    expect(usedCount(s)).toBe(2);
  });
});
