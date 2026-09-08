import { describe, it, expect } from "vitest";

import { Simulation } from "@/physics/world";
import { makeStage, boardAt } from "../helpers/stage";
import type { Stage } from "@/types/stage";

/**
 * F-13 の前提となる機構 — 規定運動(mover)・物体間リンク(link)・複数ボール。
 *
 * 原仕様 §22 の Stage 13(Elevator)/ 14(Pulley)/ 15(Rotating Platform)/
 * 17(Multiple Balls)/ 18(Moving Goal)は、これらが無いと作れない。
 *
 * **検査は閉じた式で書かない**(HC-045)。運動を `base + A·sin(2π(t/P+φ))` で
 * 実装しておいて、同じ式を期待値に書けば一致はほぼ恒等式になり、緑でも何も検査していない。
 * だから式ではなく**性質**を確かめる —— 振幅の中に収まる / 周期で戻る /
 * 実際に端まで届く / 二回走らせて一致する。
 */

/**
 * 床。**規定運動を測る面には必ず敷く。**
 *
 * 床が無いとボールが世界の外へ落ち、`status` が FAILED になって `step()` が
 * 早期 return する。すると台はその tick の位置で**凍結**し、以後の観測は
 * 運動ではなく凍結値を読む。凍結値は「動かない系を測った結果」と区別がつかず、
 * 範囲の検査は空振りのまま緑になりうる(VERIF-FALSE、loop_003)。
 *
 * だから各ケースの末尾で `status` が RUNNING のままであることも確かめる。
 */
const FLOOR = boardAt("floor", 450, 520, 900, 20, 0);

/** 上下に振動する台。 */
function elevatorStage(overrides: Partial<Stage> = {}): Stage {
  return makeStage({
    fixedObjects: [
      FLOOR,
      boardAt("lift", 300, 400, 200, 20, 0),
      { id: "m1", kind: "mover", target: "lift", motion: "oscillateY", amplitude: 100, periodTicks: 120 },
    ],
    ...overrides,
  });
}

describe("T-030 規定運動が振幅の中に収まり、周期で戻る(F-13)", () => {
  it("上下振動が基準位置 ±振幅 の中に収まる", () => {
    const sim = new Simulation({ stage: elevatorStage() });
    const base = 400;
    const amplitude = 100;

    const ys: number[] = [];
    for (let i = 0; i < 360; i++) {
      sim.step();
      ys.push(sim.objectState("lift").y);
    }

    // 凍結値を測っていないこと(この面は決着しない)。
    expect(sim.status).toBe("RUNNING");

    // 許容は 1 px。境界ちょうどを弾かないための余裕であって、閉じた式の再現ではない。
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(base - amplitude - 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(base + amplitude + 1);
  });

  it("実際に上端と下端の近くまで届く(振幅が名ばかりでない)", () => {
    // 前提の固定(HC-079): 「範囲に収まる」だけなら動かなくても緑になる。
    const sim = new Simulation({ stage: elevatorStage() });
    const ys: number[] = [];
    for (let i = 0; i < 360; i++) {
      sim.step();
      ys.push(sim.objectState("lift").y);
    }

    expect(sim.status).toBe("RUNNING");
    expect(Math.max(...ys)).toBeGreaterThan(400 + 90);
    expect(Math.min(...ys)).toBeLessThan(400 - 90);
  });

  it("1 周期後に基準位置へ戻る", () => {
    const sim = new Simulation({ stage: elevatorStage() });
    sim.runTicks(120); // periodTicks
    expect(sim.status).toBe("RUNNING");
    expect(sim.objectState("lift").y).toBeCloseTo(400, 6);
  });
});

describe("T-031 回転する床(F-13)", () => {
  it("角度が単調に増え、1 周期で 2π 進む", () => {
    const sim = new Simulation({
      stage: makeStage({
        fixedObjects: [
          FLOOR,
          boardAt("spin", 450, 300, 220, 20, 0),
          { id: "m1", kind: "mover", target: "spin", motion: "rotate", periodTicks: 180 },
        ],
      }),
    });

    const angles: number[] = [];
    for (let i = 0; i < 180; i++) {
      sim.step();
      angles.push(sim.objectState("spin").angle);
    }

    expect(sim.status).toBe("RUNNING");

    // 単調増加(角度は正規化せずに積み上げる)
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]).toBeGreaterThan(angles[i - 1]);
    }
    expect(angles[angles.length - 1]).toBeCloseTo(2 * Math.PI, 4);
  });
});

describe("T-032 動くゴール(F-13)", () => {
  it("ゴールが実際に動く", () => {
    const sim = new Simulation({
      stage: makeStage({
        goal: { x: 450, y: 300, width: 60, height: 60 },
        fixedObjects: [
          FLOOR,
          { id: "m1", kind: "mover", target: "goal", motion: "oscillateX", amplitude: 150, periodTicks: 200 },
        ],
      }),
    });

    const xs: number[] = [];
    for (let i = 0; i < 200; i++) {
      sim.step();
      xs.push(sim.goal.position.x);
    }

    expect(sim.status).toBe("RUNNING");
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(250);
  });
});

describe("T-033 動く台がボールを運ぶ(F-13)", () => {
  it("台に載ったボールが持ち上がる", () => {
    // これが `updateVelocity = true` を選んだ理由である。速度を与えないと
    // 台だけが動いてボールは取り残され、エレベータにならない。
    const sim = new Simulation({
      stage: makeStage({
        ball: { x: 300, y: 360, radius: 14, density: 0.001, friction: 0.5, restitution: 0.1 },
        fixedObjects: [
          boardAt("lift", 300, 400, 200, 20, 0),
          // 位相 0.25 から始めて、最初の半周期で上へ動かす。
          { id: "m1", kind: "mover", target: "lift", motion: "oscillateY", amplitude: 120, periodTicks: 240, phase: 0.25 },
        ],
      }),
    });

    // まず落ち着かせる(台の上に載る)。
    sim.runTicks(30);
    const settled = sim.ballState().y;

    sim.runTicks(90);
    const lifted = sim.ballState().y;

    // y は下向きが正なので、持ち上がると値が小さくなる。
    expect(lifted).toBeLessThan(settled - 50);
  });
});

describe("T-034 複数ボール(F-13)", () => {
  it("追加のボールが存在し、主ボールと衝突する", () => {
    const sim = new Simulation({
      stage: makeStage({
        ball: { x: 300, y: 60, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        extraBalls: [
          { x: 300, y: 300, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        ],
        fixedObjects: [boardAt("floor", 300, 460, 300, 20, 0)],
      }),
    });

    const before = sim.objectState("ball-2").y;
    sim.runTicks(200);

    expect(sim.collisionCount).toBeGreaterThan(0);
    // 追加ボールも物理で動く(落ちる or 押される)。
    expect(sim.objectState("ball-2").y).not.toBe(before);
  });

  it("追加ボールではゴールできない(判定は主ボールだけ)", () => {
    // ゴールの中に追加ボールを置いても CLEAR にならないこと。
    // これを許すと「どの球でもよい」面になり、面の意味が変わる。
    const sim = new Simulation({
      stage: makeStage({
        ball: { x: 100, y: 60, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        goal: { x: 700, y: 400, width: 60, height: 60 },
        extraBalls: [
          { x: 700, y: 400, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        ],
        fixedObjects: [boardAt("shelf", 700, 440, 200, 20, 0)],
      }),
    });

    sim.runTicks(120);
    expect(sim.status).not.toBe("CLEAR");
  });
});

describe("T-035 物体間リンク(F-13)", () => {
  it("繋がれた 2 つの箱が互いに影響する", () => {
    const linked = new Simulation({
      stage: makeStage({
        fixedObjects: [
          { id: "a", kind: "block", x: 300, y: 200, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.2 },
          { id: "b", kind: "block", x: 500, y: 200, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.2 },
          { id: "l1", kind: "link", bodyA: "a", bodyB: "b", length: 200, stiffness: 0.9 },
          { id: "s1", kind: "spring", anchorX: 300, anchorY: 80, objectId: "a", length: 60, stiffness: 0.9, damping: 0.1 },
        ],
      }),
    });

    // 対照: リンクが無ければ b は自由落下する。
    const unlinked = new Simulation({
      stage: makeStage({
        fixedObjects: [
          { id: "a", kind: "block", x: 300, y: 200, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.2 },
          { id: "b", kind: "block", x: 500, y: 200, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.2 },
          { id: "s1", kind: "spring", anchorX: 300, anchorY: 80, objectId: "a", length: 60, stiffness: 0.9, damping: 0.1 },
        ],
      }),
    });

    linked.runTicks(120);
    unlinked.runTicks(120);

    // 吊られた a に繋がれている b は、繋がれていない b より落ちない。
    expect(linked.objectState("b").y).toBeLessThan(unlinked.objectState("b").y);
  });
});

describe("T-036 機構を足しても決定論が保たれる(G-02)", () => {
  it("mover・link・複数ボールを含む世界で二回実行が一致する", () => {
    const stage = (): Stage =>
      makeStage({
        ball: { x: 300, y: 60, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        extraBalls: [
          { x: 340, y: 140, radius: 12, density: 0.001, friction: 0.2, restitution: 0.65 },
        ],
        fixedObjects: [
          boardAt("lift", 300, 400, 200, 20, 0),
          { id: "m1", kind: "mover", target: "lift", motion: "oscillateY", amplitude: 80, periodTicks: 90 },
          boardAt("spin", 600, 300, 180, 20, 0),
          { id: "m2", kind: "mover", target: "spin", motion: "rotate", periodTicks: 140 },
          { id: "k1", kind: "block", x: 500, y: 120, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.2 },
          { id: "k2", kind: "block", x: 560, y: 120, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.2 },
          { id: "l1", kind: "link", bodyA: "k1", bodyB: "k2", length: 60, stiffness: 0.8 },
        ],
      });

    const a = new Simulation({ stage: stage() }).trajectory(500);
    const b = new Simulation({ stage: stage() }).trajectory(500);

    // 実際に動いていること(検査の空振り防止)。
    expect(a[500].ball.y).not.toBe(a[0].ball.y);

    for (let i = 0; i <= 500; i++) {
      expect(b[i].ball.x).toBe(a[i].ball.x);
      expect(b[i].ball.y).toBe(a[i].ball.y);
      expect(b[i].ball.vy).toBe(a[i].ball.vy);
    }
  });
});
