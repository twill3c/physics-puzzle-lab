import { describe, it, expect } from "vitest";

import { Simulation } from "@/physics/world";
import { GOAL_DWELL_TICKS } from "@/lib/constants";
import { makeStage, boardAt } from "../helpers/stage";

/**
 * G-07 — ゴール判定。原仕様 §16「300 ms 以上滞在」。
 *
 * 期待値の出所: 原仕様 §16 と SPEC.md D-05(300 ms = 18 tick @ 60 Hz)。
 *
 * 一瞬の通過をクリアにしないことが要点である。センサーは跳ね返さないので、
 * 速いボールはゴールを**通り抜ける** —— 通過を数えてしまうと、
 * 「ゴールに入れた」ではなく「ゴールの前を横切った」で面が終わる。
 */

/** ゴールの真上からボールを落とす。受け止める板は置かない = 通過する。 */
function passThroughStage() {
  return makeStage({
    ball: { x: 100, y: 60, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
    goal: { x: 100, y: 300, width: 60, height: 60 },
    fixedObjects: [],
  });
}

/** 同じ配置に、ゴールの中でボールが止まるよう板を足したもの。 */
function restInsideStage() {
  return makeStage({
    ball: { x: 100, y: 60, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
    goal: { x: 100, y: 300, width: 60, height: 60 },
    fixedObjects: [boardAt("floor", 100, 340, 200, 20, 0)],
  });
}

describe("T-026 一瞬の通過はクリアにしない(G-07)", () => {
  it("ゴールを通り抜けるだけでは CLEAR にならない", () => {
    const sim = new Simulation({ stage: passThroughStage() });

    let maxDwell = 0;
    let everCleared = false;
    for (let i = 0; i < 400; i++) {
      sim.step();
      maxDwell = Math.max(maxDwell, sim.goalDwellTicks);
      if (sim.status === "CLEAR") everCleared = true;
    }

    // 前提の固定(HC-079): 実際にゴールへ入っていること。
    // 一度も触れていなければ、この検査は「通過を弾いた」ことを何も示さない。
    expect(maxDwell).toBeGreaterThan(0);

    expect(maxDwell).toBeLessThan(GOAL_DWELL_TICKS);
    expect(everCleared).toBe(false);
  });

  it("ゴールを出たら滞在カウントが 0 に戻る", () => {
    // 連続滞在を要求している(出入りの合計ではない)ことを、
    // カウンタの推移そのもので確かめる。
    const sim = new Simulation({ stage: passThroughStage() });

    const dwells: number[] = [];
    for (let i = 0; i < 400; i++) {
      sim.step();
      dwells.push(sim.goalDwellTicks);
    }

    const peak = Math.max(...dwells);
    const peakIndex = dwells.indexOf(peak);

    expect(peak).toBeGreaterThan(0);
    // 山を越えた後に 0 へ戻っている。
    expect(dwells.slice(peakIndex).some((d) => d === 0)).toBe(true);
  });
});

describe("T-027 滞在し続ければクリアになる(G-07)", () => {
  it("ゴールの中で止まると CLEAR になる", () => {
    const sim = new Simulation({ stage: restInsideStage() });
    const result = sim.runUntilSettled();

    expect(result.status).toBe("CLEAR");
    expect(result.goalDwellTicks).toBeGreaterThanOrEqual(GOAL_DWELL_TICKS);
  });

  it("CLEAR になるのは 18 tick 目であって、それより早くない", () => {
    // 判定のしきい値がずれていないことを、到達 tick で押さえる。
    const sim = new Simulation({ stage: restInsideStage() });

    let clearedAt = -1;
    let firstTouchAt = -1;
    for (let i = 0; i < 600 && clearedAt < 0; i++) {
      sim.step();
      if (firstTouchAt < 0 && sim.goalDwellTicks === 1) firstTouchAt = sim.tick;
      if (sim.status === "CLEAR") clearedAt = sim.tick;
    }

    expect(firstTouchAt).toBeGreaterThan(0);
    expect(clearedAt).toBeGreaterThan(0);
    // 最初に触れてから、連続 18 tick 目でクリアになる。
    // (途中で一度出れば数え直しになるので、差は 18 以上になりうる)
    expect(clearedAt - firstTouchAt + 1).toBeGreaterThanOrEqual(GOAL_DWELL_TICKS);
  });
});

describe("T-028 しきい値が原仕様 §16 の 300 ms と対応する(G-07)", () => {
  it("18 tick である", () => {
    expect(GOAL_DWELL_TICKS).toBe(18);
  });
});
