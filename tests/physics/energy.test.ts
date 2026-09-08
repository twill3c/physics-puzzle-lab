import { describe, it, expect } from "vitest";

import { Simulation } from "@/physics/world";
import { gravityPerTick2, GRAVITY_SCALE } from "@/physics/engine";
import { makeStage } from "../helpers/stage";

/**
 * G-04 — 力学的エネルギーの保存。
 *
 * これは**外から持ち込んだ物理の不変量**であって、エンジンの積分則から導いた式ではない
 * (SPEC O-4)。エンジンの積分を検査側で書き直せば循環するが、保存量を測るだけなら循環しない。
 *
 * 測るのは**自由飛行のあいだ**に限る。衝突の解決は位置補正を伴うのでエネルギーを
 * 出し入れする。接触を含めると「積分が保存するか」ではなく「衝突解法が保存するか」を
 * 測ることになり、主張がぼやける。接触が 0 件であることはテスト内で assert する(HC-070)。
 */

const FLIGHT_TICKS = 50;

/**
 * 接触の無い自由飛行のステージ。
 *
 * 論理キャンバス 540 に対し y=60 から 50 tick 落ちても床へ届かない
 * (この前提はテスト本体の「接触 0 件」assert で固定する)。
 */
function freeFlightStage() {
  return makeStage({ fixedObjects: [] });
}

/**
 * 空気抵抗を切った世界。
 *
 * 標準世界の既定は `frictionAir = 0.01`(原仕様 §17)で、これは**散逸**である。
 * 積分の性質を見たいので、ここでは切る。切らずに測ると散逸を積分誤差と取り違える
 * (実際に段階 3 で取り違えた —— VERIF-FALSE、loop_001)。
 */
const LOSSLESS = { frictionAir: 0 } as const;

describe("T-013 重力の実効加速度が matter-js の実装と一致する(G-04)", () => {
  it("ソースから導いた加速度が、実際に観測される加速度と一致する", () => {
    // HC-075: 外部実装の書式・定数を「たいていこう」で書くと、変わった日に黙って違う結果を出す。
    // だから導出値と観測値を突き合わせ、仮定が崩れたら落ちるようにする。
    //
    // 導出: matter-js 0.20 の Engine._bodiesApplyGravity は
    //   force.y += mass * gravity.y * gravityScale (gravityScale 既定 0.001)
    // Body.update は Verlet で
    //   velocity += (force/mass) * deltaTime^2
    // よって 1 tick あたりの速度増分(= px/tick^2)は gravity.y * 0.001 * dt^2。
    const stage = freeFlightStage();
    const derived = gravityPerTick2(stage.world.gravityY);

    const sim = new Simulation({ stage, world: LOSSLESS });
    const traj = sim.trajectory(FLIGHT_TICKS);

    // 前提: この窓では接触が起きていない。
    expect(sim.collisionCount).toBe(0);

    // 観測: 連続する tick の速度差が実効加速度そのもの(静止から始めた自由落下)。
    for (let i = 2; i <= FLIGHT_TICKS; i++) {
      const observed = traj[i].ball.vy - traj[i - 1].ball.vy;
      expect(observed).toBeCloseTo(derived, 10);
    }
  });

  it("gravityScale の既定値が 0.001 のままである", () => {
    // この定数が変わると上の導出が黙って外れるので、単独で固定しておく。
    expect(GRAVITY_SCALE).toBe(0.001);
  });
});

describe("T-014 自由飛行で力学的エネルギーが保たれる(G-04)", () => {
  it("相対変動が閾値内に収まる", () => {
    const sim = new Simulation({ stage: freeFlightStage(), world: LOSSLESS });
    const energies: number[] = [];

    for (let i = 0; i < FLIGHT_TICKS; i++) {
      sim.step();
      energies.push(sim.mechanicalEnergy());
    }

    // 前提の固定(HC-070): 接触が無く、実際に運動していること。
    expect(sim.collisionCount).toBe(0);
    expect(energies.length).toBe(FLIGHT_TICKS);

    const max = Math.max(...energies);
    const min = Math.min(...energies);
    const drift = (max - min) / Math.abs(energies[0]);

    // 実測 2026-09-08: 自由飛行 50 tick・接触 0 件・frictionAir=0 で drift = 0.0142。
    // 閾値はその約 2 倍を取る。
    //
    // **この残差は散逸ではない。** matter-js の `body.velocity` は Verlet の
    // 後退差分(tick n-1 → n の変位)なので、tick n の運動エネルギーは
    // 半 tick ずれた速度と、ずれていない位置とを組み合わせている。
    // 等加速度では E_n = E_0 − a²n/2 という**系統的な帳尻**になり、
    // 窓の長さに比例して増える。したがってこの閾値は「50 tick の窓」に対する値であって、
    // 窓を伸ばせば超える。窓を変えるときは測り直すこと。
    //
    // 帳尻と本物の散逸を区別できることは T-015 の陽性対照が示す
    // (同じ窓で散逸ありは 0.179 = 約 12.6 倍)。
    const MAX_DRIFT = 0.03;
    expect(drift).toBeLessThanOrEqual(MAX_DRIFT);
  });
});

describe("T-015 エネルギー計器そのものの検査 — 陽性対照(G-04)", () => {
  it("空気抵抗を入れるとエネルギーが目に見えて減る", () => {
    // HC-041 / HC-079: 「保存された」を返す計器が、実際に散逸を捕まえられることを確かめる。
    // これが撃たないなら、T-014 の緑は「保存している」ではなく「何も測っていない」を意味する。
    const stage = freeFlightStage();
    const lossless = new Simulation({ stage, world: LOSSLESS });
    const lossy = new Simulation({ stage, world: { frictionAir: 0.05 } });

    lossless.runTicks(FLIGHT_TICKS);
    lossy.runTicks(FLIGHT_TICKS);

    expect(lossless.collisionCount).toBe(0);
    expect(lossy.collisionCount).toBe(0);

    const e0 = new Simulation({ stage, world: LOSSLESS }).mechanicalEnergy();
    const lossyDrop = (e0 - lossy.mechanicalEnergy()) / Math.abs(e0);
    const losslessDrop = (e0 - lossless.mechanicalEnergy()) / Math.abs(e0);

    // 散逸側は「はっきり減る」、無損失側は「帳尻ぶんしか減らない」。
    expect(lossyDrop).toBeGreaterThan(0);
    expect(lossyDrop).toBeGreaterThan(losslessDrop);

    // 計器が両者を**区別できる**ことを数で押さえる。ここが緑にならないなら、
    // T-014 の緑は「保存している」ではなく「何も測っていない」を意味する。
    // 実測 2026-09-08: 散逸 0.179 / 無損失 0.0142(約 12.6 倍)。
    expect(lossyDrop).toBeGreaterThan(losslessDrop * 4);
  });
});
