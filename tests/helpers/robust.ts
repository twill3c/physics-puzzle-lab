import { Simulation } from "@/physics/world";
import type { Placement } from "@/types/physics";
import type { Stage } from "@/types/stage";

/**
 * 解答の頑健さ —— 「厳密な座標なら解ける」と「人が置ける精度で置いても解ける」は別の主張である
 * (SPEC G-15)。
 *
 * G-01 は同梱解答を**小数 2 桁の座標どおり**に置いて CLEAR を確かめる。しかし画面の座標は
 * `screenToLogical` で x/scale になるだけなので、指やマウスで届く配置は間隔 1/scale の格子に
 * 限られる。Pixel 7(幅 412px)では scale = 412/900 で格子の間隔は約 2.18 論理 px、
 * 最寄りの届く点までの誤差は最大でその半分になる。
 *
 * **ここに書いた数は loop_010 の段階 1 で、測る前に固定した。** 測ってから動かさない。
 */

/** 指で届く格子の半間隔(900/412/2 = 1.092)を切り上げた値。論理 px。 */
export const FINGER_DELTA = 1.1;

/** G-15 の合格線。ずれを入れた試行のうち CLEAR に届く割合。 */
export const MIN_CLEAR_RATE = 0.9;

/** 1 面あたりの試行回数。 */
export const TRIALS = 32;

/** 乱数の種。面ごとに id を混ぜる。 */
export const SEED = 20260914;

/** 陽性対照のずれ。これで一面も落ちなければ、検査はずれを見分けていない。 */
export const CONTROL_DELTA = 120;

/**
 * 決定論のための線形合同法(`solve.ts` と同じ定数)。`Math.random` では結果が再現しない。
 * 同じ種なら δ を変えても**同じ向きのずれを δ 倍しただけ**になるので、δ ごとの率を比べられる。
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 各部品の x・y に [-δ, δ] の一様なずれを入れる。角度は触らない(スライダーは 0.01 rad で解答角に届く)。 */
export function jitterPlacements(solution: Placement[], delta: number, rng: () => number): Placement[] {
  return solution.map((p) => ({
    ...p,
    x: p.x + (rng() * 2 - 1) * delta,
    y: p.y + (rng() * 2 - 1) * delta,
  }));
}

export interface ClearRate {
  cleared: number;
  trials: number;
  rate: number;
}

/** δ のずれを入れて `trials` 回走らせ、CLEAR に届いた割合を返す。 */
export function clearRate(
  stage: Stage,
  delta: number,
  opts: { trials?: number; seed?: number } = {},
): ClearRate {
  const trials = opts.trials ?? TRIALS;
  const rng = makeRng((opts.seed ?? SEED) + stage.id);

  let cleared = 0;
  for (let i = 0; i < trials; i++) {
    const placements = jitterPlacements(stage.solution, delta, rng);
    const result = new Simulation({ stage, placements }).runUntilSettled();
    if (result.status === "CLEAR") cleared += 1;
  }

  return { cleared, trials, rate: cleared / trials };
}
