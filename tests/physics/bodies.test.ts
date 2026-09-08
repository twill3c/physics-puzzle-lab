import { describe, it, expect } from "vitest";

import { Simulation } from "@/physics/world";
import { makeStage, boardAt, placement } from "../helpers/stage";
import { CANVAS_HEIGHT } from "@/lib/constants";

/**
 * F-04..F-07 — 各部品が「効く」ことを、効かない対照と対にして確かめる。
 *
 * 期待値の出所: 原仕様 §11(Board)/ §12(Block)/ §13(Spring)/ §14(Fan)。
 * どれも**向きと有無**だけを主張し、具体的な数値は主張しない ——
 * 数値は SPEC の保証粒度を超える(HC-016)。
 */

describe("T-016 Board がボールを受け止める(F-04)", () => {
  it("板がある場合だけボールが板の上で止まる", () => {
    const withBoard = new Simulation({
      stage: makeStage({ fixedObjects: [boardAt("b1", 100, 300, 240, 20, 0)] }),
    });
    const without = new Simulation({ stage: makeStage({ fixedObjects: [] }) });

    withBoard.runTicks(240);
    without.runTicks(240);

    // 板の上で受け止められているので、板より下へは行かない。
    expect(withBoard.ballState().y).toBeLessThan(300);
    // 対照: 板が無ければ同じ tick 数でもっと下まで落ちている。
    expect(without.ballState().y).toBeGreaterThan(withBoard.ballState().y);
    expect(withBoard.collisionCount).toBeGreaterThan(0);
  });
});

describe("T-017 Block が物理挙動する(F-05)", () => {
  it("動的な箱は重力で落ち、静的な箱は動かない", () => {
    const dynamic = new Simulation({
      stage: makeStage({
        fixedObjects: [
          {
            id: "k1",
            kind: "block",
            x: 500,
            y: 100,
            width: 40,
            height: 40,
            density: 0.001,
            friction: 0.3,
            restitution: 0.4,
          },
        ],
      }),
    });

    const before = dynamic.objectState("k1").y;
    dynamic.runTicks(60);
    expect(dynamic.objectState("k1").y).toBeGreaterThan(before);

    const staticBlock = new Simulation({
      stage: makeStage({
        fixedObjects: [
          {
            id: "k2",
            kind: "block",
            x: 500,
            y: 100,
            width: 40,
            height: 40,
            density: 0.001,
            friction: 0.3,
            restitution: 0.4,
            isStatic: true,
          },
        ],
      }),
    });
    const staticBefore = staticBlock.objectState("k2").y;
    staticBlock.runTicks(60);
    expect(staticBlock.objectState("k2").y).toBe(staticBefore);
  });
});

describe("T-018 Spring がボールを引き戻す(F-06)", () => {
  it("ばねで吊るしたボールは落ち続けず、往復する", () => {
    // ボールを自然長より **下** から始める。段階 3 では自然長ちょうどに置いたため
    // 振幅が 0.9 px しか出ず、「往復していない」ように見えた(VERIF-FALSE、loop_001)。
    // 自然長は anchorY + length = 120 + 80 = 200。そこから 120 px 下げて吊るす。
    const sim = new Simulation({
      stage: makeStage({
        ball: { x: 300, y: 320, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        fixedObjects: [
          {
            id: "s1",
            kind: "spring",
            anchorX: 300,
            anchorY: 120,
            objectId: "ball",
            length: 80,
            stiffness: 0.05,
            damping: 0,
          },
        ],
      }),
      world: { frictionAir: 0 },
    });

    const ys: number[] = [];
    for (let i = 0; i < 400; i++) {
      sim.step();
      ys.push(sim.ballState().y);
    }

    const lowest = Math.max(...ys);
    // 自由落下なら 400 tick で床(540)へ達している。ばねが効いていれば途中で止まる。
    expect(lowest).toBeLessThan(CANVAS_HEIGHT - 40);

    // 往復していること = 一度下がってから、はっきり戻る点がある。
    // 「はっきり」は自然長側へ 20 px 以上戻ることとする(振幅 120 px に対して十分小さい)。
    const lowestIndex = ys.indexOf(lowest);
    const reboundsAfter = ys.slice(lowestIndex).some((y) => y < lowest - 20);
    expect(reboundsAfter).toBe(true);
  });
});

describe("T-019 Fan が範囲内の物体を押す(F-07)", () => {
  it("送風の向きに押され、範囲外では押されない", () => {
    // 原仕様 §14: forceX = cos(direction) × power, forceY = sin(direction) × power。
    // direction = 0 は x 軸正方向(Canvas 座標なので右向き)。
    const inRange = new Simulation({
      stage: makeStage({
        ball: { x: 300, y: 100, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        fixedObjects: [
          { id: "f1", kind: "fan", x: 300, y: 100, direction: 0, power: 0.02, range: 200 },
        ],
      }),
    });

    // 範囲外の対照は**送風源を離して**作る。段階 3 ではボールと同座標に置いたまま
    // range だけ縮めたので、距離 0 で常に範囲内だった(VERIF-FALSE、loop_001)。
    const outOfRange = new Simulation({
      stage: makeStage({
        ball: { x: 300, y: 100, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
        fixedObjects: [
          { id: "f1", kind: "fan", x: 700, y: 100, direction: 0, power: 0.02, range: 50 },
        ],
      }),
    });

    inRange.runTicks(60);
    outOfRange.runTicks(60);

    // 効いている側は右へ動く。
    expect(inRange.ballState().x).toBeGreaterThan(300);
    // 対照: 範囲外なら横方向には動かない(重力は縦向きなので x は変わらない)。
    expect(outOfRange.ballState().x).toBeCloseTo(300, 6);
  });

  it("送風の向きを反転すると押される向きも反転する", () => {
    const make = (direction: number) =>
      new Simulation({
        stage: makeStage({
          ball: { x: 450, y: 100, radius: 14, density: 0.001, friction: 0.2, restitution: 0.65 },
          fixedObjects: [
            { id: "f1", kind: "fan", x: 450, y: 100, direction, power: 0.02, range: 200 },
          ],
        }),
      });

    const right = make(0);
    const left = make(Math.PI);
    right.runTicks(60);
    left.runTicks(60);

    expect(right.ballState().x).toBeGreaterThan(450);
    expect(left.ballState().x).toBeLessThan(450);
  });
});

describe("T-020 プレイヤーの配置が世界に入る(F-09)", () => {
  it("配置した板がボールを受け止める", () => {
    const stage = makeStage({ tools: { board: 1, block: 0, spring: 0, fan: 0 } });
    const withPlacement = new Simulation({
      stage,
      placements: [placement("p1", "board", 100, 300, 0, { width: 240, height: 20 })],
    });
    const without = new Simulation({ stage });

    withPlacement.runTicks(240);
    without.runTicks(240);

    expect(withPlacement.ballState().y).toBeLessThan(300);
    expect(without.ballState().y).toBeGreaterThan(withPlacement.ballState().y);
  });
});
