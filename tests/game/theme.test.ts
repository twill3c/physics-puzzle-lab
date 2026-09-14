import { describe, it, expect } from "vitest";

import { getStage } from "@/game/stageManager";
import { Simulation } from "@/physics/world";
import type { Placement } from "@/types/physics";
import type { Stage } from "@/types/stage";
import { THEMES } from "../helpers/theme";

/**
 * T-077 — 同梱解答は、面の主題となる現象を起こしてクリアする(G-15 の補い)。
 *
 * G-01 / G-15 はクリアしたか・クリアの幅しか見ない。loop_010 で Domino の解答を幅で
 * 選び直したとき、**ボールが牌を飛び越えてゴールへ届く解答**(G-15 は 32/32)を選んでいた。
 * 面の主題「倒れた牌は、次の牌へ勢いを渡す」を迂回した解答を「配れる解答」と呼ばないために、
 * 主題の条件を同梱解答に対して検査する。
 */

function themeHolds(stage: Stage, placements: Placement[]): { cleared: boolean; holds: boolean } {
  const sim = new Simulation({ stage, placements });
  const theme = THEMES[stage.id](sim);
  const cleared = sim.runUntilSettled().status === "CLEAR";
  return { cleared, holds: theme.holds(sim) };
}

/**
 * 対照を当てる面は、**loop_010 で形を直す前の stage12 を凍結した写し**にする。
 *
 * 対照が確かめたいのは「条件が、牌を倒した走りを受け入れ、飛び越えた走りを弾くか」であって、
 * いまの面の性質ではない。現在の面に当てると、面の形を直すたびに対照が前提を失う
 * (実際、deck を傾けた直後に陽性対照が落ちた)。また、条件を課して選んだ解答を陽性対照に
 * 使うと循環する。そこで、牌の最終状態を実測済みの二つの走り(元の解答 = 倒した /
 * 飛び越えた解答 = 触れていない)を、その走りが起きた面ごと固定する。
 */
function frozenStage12(): Stage {
  const live = getStage(12);
  const domino = (id: string, x: number) => ({
    id,
    kind: "block" as const,
    x,
    y: 355,
    width: 14,
    height: 70,
    angle: 0,
    density: 0.0006,
    friction: 0.4,
    restitution: 0.1,
    isStatic: false,
  });
  return {
    ...live,
    goal: { x: 620, y: 366, width: 120, height: 80 },
    fixedObjects: [
      { id: "deck", kind: "board", x: 450, y: 400, width: 520, height: 20, angle: 0, isStatic: true },
      domino("d1", 330),
      domino("d2", 375),
      domino("d3", 420),
      domino("d4", 465),
    ],
  } as Stage;
}

/** loop_004 で作った元の解答。凍結した面で d1・d2 を押し滑らせ、d3・d4 を倒していた。 */
const ORIGINAL: Placement[] = [
  { id: "p1", kind: "board", x: 185.01, y: 236.15, angle: 0.4 },
  { id: "p2", kind: "board", x: 303.11, y: 313.42, angle: 0.21 },
];

/** loop_010 で幅だけで選んで採らなかった解答。凍結した面で牌を飛び越えてゴールへ届く。 */
const BYPASS: Placement[] = [
  { id: "p1", kind: "board", x: 168.44, y: 126.85, angle: 0.54 },
  { id: "p2", kind: "board", x: 351.13, y: 284.04, angle: 0.4 },
];

describe("T-077 同梱解答は面の主題を起こしてクリアする(G-15)", () => {
  it("stage12 Domino の同梱解答は、牌の列の端まで勢いを渡してクリアする", () => {
    const stage = getStage(12);
    const r = themeHolds(stage, stage.solution);
    expect(r.cleared, "同梱解答がクリアしない").toBe(true);
    expect(r.holds, "同梱解答が牌を迂回している").toBe(true);
  });

  it("陽性対照: 凍結した面で、元の解答(loop_004)は条件を満たす", () => {
    const r = themeHolds(frozenStage12(), ORIGINAL);
    expect(r.cleared, "対照が前提を失っている(凍結した面で元の解答がクリアしない)").toBe(true);
    expect(r.holds, "条件が、牌を倒した走りを弾いている").toBe(true);
  });

  it("陰性対照: 凍結した面で、牌を飛び越える解答はクリアしても条件を満たさない", () => {
    const r = themeHolds(frozenStage12(), BYPASS);
    expect(r.cleared, "対照が前提を失っている(凍結した面で飛び越えた解答がクリアしない)").toBe(true);
    expect(r.holds, "条件が、牌に触れていない走りを受け入れている").toBe(false);
  });
});
