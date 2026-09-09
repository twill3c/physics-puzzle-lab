import { describe, it, expect } from "vitest";

import { buildRenderModel, hitTest, screenToLogical, fitCanvas } from "@/lib/render";
import { Simulation } from "@/physics/world";
import { getStage } from "@/game/stageManager";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/constants";

/**
 * F-01 — 描画。
 *
 * **「何をどこに描くか」を純関数で出し、Canvas 呼び出しはその結果をなぞるだけにする。**
 * こうしないと、描画の正しさは目視でしか確かめられない。図の要素は
 * 図を生成したのと同じデータから導くこと(HC-045)。
 *
 * ここで検査するのは幾何(位置・大きさ・数)であって、色や見た目ではない。
 */

describe("T-060 描画モデルが世界の中身を漏れなく含む(F-01)", () => {
  it("ボール・ゴール・固定物・配置がすべて図形になる", () => {
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });
    const model = buildRenderModel(sim, stage);

    // ボールは 1 つ、ゴールは 1 つ。
    expect(model.shapes.filter((s) => s.role === "ball")).toHaveLength(1);
    expect(model.shapes.filter((s) => s.role === "goal")).toHaveLength(1);

    // stage02 の固定物は棚 1 枚、配置は解答の 2 枚。
    expect(model.shapes.filter((s) => s.role === "fixed")).toHaveLength(1);
    expect(model.shapes.filter((s) => s.role === "placed")).toHaveLength(2);

    // 外枠は描かない(画面の外にあるので描いても見えない)。
    expect(model.shapes.some((s) => s.id.startsWith("wall-"))).toBe(false);
  });

  it("図形の座標が物理の状態と一致する", () => {
    // 図の中の値は、図を生成したのと同じデータから導くこと(HC-045)。
    // 描画側が独自に位置を計算していないことを確かめる。
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });
    sim.runTicks(120);

    const model = buildRenderModel(sim, stage);
    const ball = model.shapes.find((s) => s.role === "ball")!;

    expect(ball.x).toBe(sim.ballState().x);
    expect(ball.y).toBe(sim.ballState().y);
  });

  it("動いたら図形も動く", () => {
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });

    const before = buildRenderModel(sim, stage).shapes.find((s) => s.role === "ball")!;
    sim.runTicks(90);
    const after = buildRenderModel(sim, stage).shapes.find((s) => s.role === "ball")!;

    expect(after.y).not.toBe(before.y);
  });

  it("多角形は頂点で持つ(角度を二重に持たない)", () => {
    // 角度と頂点の両方を持つと、片方だけ更新されたときに図が嘘をつく。
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });
    const model = buildRenderModel(sim, stage);

    const board = model.shapes.find((s) => s.role === "placed")!;
    expect(board.kind).toBe("polygon");
    expect(board.vertices!.length).toBeGreaterThanOrEqual(4);
  });

  it("ゴール滞在中はゴールの状態が変わる(色以外の手掛かり)", () => {
    // SPEC N-06: 状態は色だけで表さない。
    const stage = getStage(1);
    const sim = new Simulation({ stage });

    const idle = buildRenderModel(sim, stage).shapes.find((s) => s.role === "goal")!;
    expect(idle.active).toBe(false);

    sim.runUntilSettled();
    const done = buildRenderModel(sim, stage).shapes.find((s) => s.role === "goal")!;
    expect(done.active).toBe(true);
  });
});

describe("T-061 画面座標と論理座標の往復(F-27 / F-29)", () => {
  it("拡大縮小しても往復して元に戻る", () => {
    // タッチ・マウスの座標は画面のもの。物理は論理座標で動く。
    // 変換が往復しないと、掴んだ場所と置かれる場所がずれる。
    for (const cssWidth of [320, 480, 900, 1400]) {
      const fit = fitCanvas(cssWidth);
      for (const [lx, ly] of [
        [0, 0],
        [450, 270],
        [CANVAS_WIDTH, CANVAS_HEIGHT],
      ]) {
        const screen = { x: lx * fit.scale, y: ly * fit.scale };
        const back = screenToLogical(screen.x, screen.y, fit.scale);
        expect(back.x).toBeCloseTo(lx, 6);
        expect(back.y).toBeCloseTo(ly, 6);
      }
    }
  });

  it("狭い画面では縮小、広い画面でも論理サイズを超えて拡大しない", () => {
    expect(fitCanvas(450).scale).toBeCloseTo(0.5, 6);
    // 大きすぎる拡大は文字と当たり判定が粗くなるだけなので上限を置く。
    expect(fitCanvas(3000).scale).toBeLessThanOrEqual(2);
  });
});

describe("T-062 掴み判定(F-10)", () => {
  it("置いた部品の上を指せば掴める", () => {
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });
    const model = buildRenderModel(sim, stage);

    const target = stage.solution[0];
    expect(hitTest(model, target.x, target.y)).toBe(target.id);
  });

  it("何も無い所を指せば掴めない", () => {
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });
    const model = buildRenderModel(sim, stage);

    expect(hitTest(model, 870, 40)).toBeNull();
  });

  it("固定物とボールは掴めない(動かせるのは置いた部品だけ)", () => {
    const stage = getStage(2);
    const sim = new Simulation({ stage, placements: stage.solution });
    const model = buildRenderModel(sim, stage);

    expect(hitTest(model, stage.ball.x, stage.ball.y)).toBeNull();
    const shelf = stage.fixedObjects[0] as { x: number; y: number };
    expect(hitTest(model, shelf.x, shelf.y)).toBeNull();
  });

  it("重なっているときは後から置いたものが優先される", () => {
    // 画面の手前にある物が掴めないと、利用者は「反応しない」と受け取る。
    const stage = getStage(2);
    const sim = new Simulation({
      stage,
      placements: [
        { id: "under", kind: "board", x: 400, y: 300, angle: 0 },
        { id: "over", kind: "board", x: 400, y: 300, angle: 0 },
      ],
    });
    const model = buildRenderModel(sim, stage);
    expect(hitTest(model, 400, 300)).toBe("over");
  });
});
