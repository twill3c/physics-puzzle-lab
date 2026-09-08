import Matter from "matter-js";

import { TICK_MS, WORLD_DEFAULTS } from "@/lib/constants";
import type { WorldParams } from "@/types/physics";

/**
 * 決定論的な固定タイムステップのエンジン層。
 *
 * ここは matter-js の薄い包みであって、物理を書き直しているのではない。
 * 包む目的はただ一つ、**同じ入力から同じ結果を出させる**ことである(SPEC D-01)。
 *
 * matter-js 0.20 の実物を読んで確かめた非決定の源(2026-09-08):
 *
 * - `Runner`(実時間 delta で更新する)→ **使わない**
 * - `Render`(rAF に乗る)→ **使わない**(描画は自前の Canvas 層で行う)
 * - `Common.random`(種つき LCG)→ 物理積分の経路からは呼ばれない
 * - `Common.now()` → `engine.timing.lastElapsed` の計測にしか使われず積分に入らない
 *
 * したがって「固定 delta・固定の生成順・Runner 不使用」の三つを守れば、
 * 同一 JS エンジン内での再現は成立する。ブラウザ横断のビット一致は主張しない(D-02)。
 */

/**
 * matter-js が重力へ掛ける係数。
 *
 * 出所: `Engine._bodiesApplyGravity`(matter-js 0.20)の既定値。
 * `force.y += mass * gravity.y * gravityScale` の `gravityScale`。
 *
 * **この値が変わると下の導出が黙って外れる。** そのため tests/physics/energy.test.ts で
 * 導出値と実測値を突き合わせ、仮定が崩れたら落ちるようにしてある(HC-075)。
 */
export const GRAVITY_SCALE = 0.001;

/**
 * 重力の実効加速度を px/tick² で返す。
 *
 * 導出: `Body.update` は Verlet 積分で
 *   `velocity += (force / mass) * deltaTime²`
 * を行い、`velocity` は「1 tick あたりの変位」である(速度/秒ではない)。
 * `force / mass = gravity.y * GRAVITY_SCALE` なので、1 tick あたりの速度増分は
 *   `gravity.y * GRAVITY_SCALE * TICK_MS²`
 * となる。エネルギーを測るときの位置エネルギーはこの加速度を使う。
 */
export function gravityPerTick2(gravityY: number): number {
  return gravityY * GRAVITY_SCALE * TICK_MS * TICK_MS;
}

/** 世界パラメータを既定値で埋める。 */
export function resolveWorldParams(partial?: Partial<WorldParams>): WorldParams {
  return { ...WORLD_DEFAULTS, ...partial };
}

/**
 * エンジンを作る。
 *
 * `timing.timeScale` は **1 のまま動かさない**。matter-js はこれを delta に掛けるので、
 * 変えると積分そのものが変わってしまう(SPEC D-07)。Slow Motion は「1 フレームで
 * 進める tick 数」で表現し、物理の刻みには触れない。
 */
export function createEngine(params: WorldParams): Matter.Engine {
  const engine = Matter.Engine.create();

  engine.gravity.x = params.gravityX;
  engine.gravity.y = params.gravityY;
  engine.gravity.scale = GRAVITY_SCALE;

  // 固定タイムステップの前提を壊さないための固定(D-01)。
  engine.timing.timeScale = 1;

  return engine;
}

/**
 * 1 tick 進める。
 *
 * delta は常に `TICK_MS`。実時間は一切参照しない —— ここが決定論の要である。
 */
export function stepEngine(engine: Matter.Engine): void {
  Matter.Engine.update(engine, TICK_MS);
}
