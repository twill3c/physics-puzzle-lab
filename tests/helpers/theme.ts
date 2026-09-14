import type { Simulation } from "@/physics/world";

/**
 * 面の主題の条件。**同梱解答は、面が教えたい現象を起こしてクリアしなければならない。**
 *
 * G-01 と G-15 はクリアしたか・クリアの幅しか見ないので、主題を迂回する経路を
 * 区別できない。loop_010 で Domino の解答を幅で選び直したとき、ボールが牌を飛び越えて
 * ゴールへ届く解答(G-15 は 32/32)を選んでいた。
 *
 * 条件はクリアした時点のシミュレーションに対して判定する(`runUntilSettled` の直後)。
 */
export interface ThemeCondition {
  label: string;
  holds: (sim: Simulation) => boolean;
}

/** 牌が「動かされた」とみなす移動量(論理 px)と傾き(rad)。 */
export const DOMINO_MOVED_PX = 10;
export const DOMINO_TILT_RAD = 0.5;
/** 列の最後の牌が「倒れた」とみなす傾き(rad)。 */
export const DOMINO_FALLEN_RAD = 1.0;

const DOMINOES = ["d1", "d2", "d3", "d4"] as const;

/**
 * Domino(stage12)の条件は、loop_004 で作った元の解答に合わせて決めた。
 * 元の解答は d1・d2 を押し滑らせ(63px・94px、角度 0)、d3・d4 を倒していた(1.28・1.57rad)。
 * 「4 枚すべて傾く」とすると元の解答すら満たさないので、**勢いが列の端まで渡った**ことを
 * 条件にする: 4 枚すべてが動かされるか傾き、最後の d4 が倒れる。
 * 陽性対照(元の解答)と陰性対照(飛び越えた解答)は tests/game/theme.test.ts にある。
 */
export function dominoTheme(initial: Map<string, { x: number; y: number }>): ThemeCondition {
  return {
    label: `牌 4 枚すべてが ${DOMINO_MOVED_PX}px 以上動くか ${DOMINO_TILT_RAD}rad 以上傾き、d4 が ${DOMINO_FALLEN_RAD}rad 以上倒れる`,
    holds: (sim) => {
      const touched = DOMINOES.every((id) => {
        const s = sim.objectState(id);
        const o = initial.get(id)!;
        return Math.hypot(s.x - o.x, s.y - o.y) >= DOMINO_MOVED_PX || Math.abs(s.angle) >= DOMINO_TILT_RAD;
      });
      return touched && Math.abs(sim.objectState("d4").angle) >= DOMINO_FALLEN_RAD;
    },
  };
}

/** 面 id → 条件を作る関数。走らせる前の初期位置を受け取る。 */
export const THEMES: Record<number, (sim: Simulation) => ThemeCondition> = {
  12: (sim) => dominoTheme(new Map(DOMINOES.map((id) => [id, sim.objectState(id)]))),
};
