import { describe, it, expect } from "vitest";

import { Simulation } from "@/physics/world";
import { makeStage, boardAt } from "../helpers/stage";

/**
 * G-02 — 決定論。
 *
 * 期待値の出所: SPEC.md D-01 / D-02 / O-2。値の観測ではなく仕様の条項である。
 *
 * この主張が成り立つ根拠(matter-js 0.20 の実物を読んで確かめた、2026-09-08):
 * 物理積分の経路に `Math.random` / `Common.random` は現れない。非決定の源は
 * `Runner`(実時間 delta)と `Render` だけで、本実装はどちらも使わない。
 * `Common.now()` は `engine.timing.lastElapsed` の計測にしか使われず、積分に入らない。
 *
 * 主張の射程は**同一 JS エンジン内**に限る(SPEC D-02)。`Math.sin` / `Math.cos` は
 * 実装依存なので、ブラウザ横断のビット一致は原理的に言えない(HC-073)。
 */

/**
 * 衝突を含む十分に複雑な盤面。
 *
 * 単純な自由落下では経路の違いが出ない。**板の位置はボールの落下線上に置くこと** ——
 * 段階 3 では x=100 から落ちるボールに対し x=260 以降へ板を置いてしまい、
 * 一度も当たらないまま世界の外へ落ちていた(VERIF-FALSE、loop_001)。
 * 実測 2026-09-08: この配置で 600 tick の衝突開始は 7 件。
 */
function busyStage() {
  return makeStage({
    fixedObjects: [
      boardAt("b1", 120, 220, 220, 20, 0.35),
      boardAt("b2", 380, 360, 240, 20, -0.3),
      boardAt("b3", 200, 470, 260, 20, 0.1),
    ],
  });
}

const TICKS = 600;

describe("T-010 同一入力の二回実行が全 tick で一致する(G-02)", () => {
  it("軌跡が全 tick でビット単位で一致する", () => {
    const a = new Simulation({ stage: busyStage() }).trajectory(TICKS);
    const b = new Simulation({ stage: busyStage() }).trajectory(TICKS);

    expect(a).toHaveLength(TICKS + 1);
    expect(b).toHaveLength(TICKS + 1);

    // 走査対象が空でない・実際に動いていることを確かめる(検査の空振り防止)。
    expect(a[TICKS].ball.y).not.toBe(a[0].ball.y);

    for (let i = 0; i <= TICKS; i++) {
      expect(b[i].ball.x).toBe(a[i].ball.x);
      expect(b[i].ball.y).toBe(a[i].ball.y);
      expect(b[i].ball.vx).toBe(a[i].ball.vx);
      expect(b[i].ball.vy).toBe(a[i].ball.vy);
      expect(b[i].ball.angle).toBe(a[i].ball.angle);
    }
  });

  it("結論だけでなく経路も一致する(HC-065)", () => {
    // 最終位置が同じでも「同じ理由で同じ」とは限らない。中間量として
    // 累計衝突回数の推移を比べる —— 別の経路で同じ場所へ着いたら、ここがずれる。
    const a = new Simulation({ stage: busyStage() });
    const b = new Simulation({ stage: busyStage() });

    const pathA: number[] = [];
    const pathB: number[] = [];
    for (let i = 0; i < TICKS; i++) {
      a.step();
      b.step();
      pathA.push(a.collisionCount);
      pathB.push(b.collisionCount);
    }

    // 対照が対照として成り立つ前提を固定する(HC-079): 実際に衝突が起きていること。
    expect(a.collisionCount).toBeGreaterThan(0);
    expect(pathA).toEqual(pathB);
  });
});

describe("T-011 決定論検査そのものの検査 — 陽性対照(G-02)", () => {
  it("初期位置を 1e-12 ずらすと軌跡が食い違う", () => {
    // HC-041: 一致検査は「本当に一致しているとき」と「比較が働いていないとき」で
    // 同じ緑を返す。ずらした入力で必ず落ちることを確かめて、比較が効いていると言う。
    const base = busyStage();
    const nudged = makeStage({
      ...base,
      ball: { ...base.ball, x: base.ball.x + 1e-12 },
    });

    // 前提の固定: 入力が実際に違うこと。
    expect(nudged.ball.x).not.toBe(base.ball.x);

    const a = new Simulation({ stage: base }).trajectory(TICKS);
    const b = new Simulation({ stage: nudged }).trajectory(TICKS);

    const diverged = a.some((s, i) => s.ball.x !== b[i].ball.x || s.ball.y !== b[i].ball.y);
    expect(diverged).toBe(true);
  });

  it("盤面を変えると軌跡が食い違う(比較が盤面を見ている)", () => {
    const a = new Simulation({ stage: busyStage() }).trajectory(TICKS);
    const b = new Simulation({
      stage: makeStage({
        fixedObjects: [
          boardAt("b1", 120, 230, 220, 20, 0.35),
          boardAt("b2", 380, 360, 240, 20, -0.3),
          boardAt("b3", 200, 470, 260, 20, 0.1),
        ],
      }),
    }).trajectory(TICKS);

    const diverged = a.some((s, i) => s.ball.x !== b[i].ball.x || s.ball.y !== b[i].ball.y);
    expect(diverged).toBe(true);
  });
});

describe("T-012 Slow Motion が軌跡を変えない(G-02 / SPEC D-07)", () => {
  it("timeScale を変えても物理の刻みは変わらない", () => {
    // 原仕様 §28 の Slow Motion は「同じものをゆっくり見る」ことであって、
    // 「別の物理を回す」ことではない。matter-js の `timing.timeScale` は
    // delta に掛かるので積分結果が変わってしまう(実物で確認、2026-09-08)。
    // 本実装は delta を固定したまま「1 フレームで進める tick 数」を変える。
    const normal = new Simulation({ stage: busyStage() }).trajectory(TICKS);
    const slow = new Simulation({ stage: busyStage(), world: { timeScale: 0.25 } }).trajectory(
      TICKS,
    );

    for (let i = 0; i <= TICKS; i++) {
      expect(slow[i].ball.x).toBe(normal[i].ball.x);
      expect(slow[i].ball.y).toBe(normal[i].ball.y);
    }
  });
});
