import { describe, it, expect } from "vitest";

import { createGame } from "@/game/gameManager";
import { getStage } from "@/game/stageManager";
import { TIME_SCALES } from "@/lib/constants";

/**
 * F-11(Start / Pause / Reset / Slow Motion)と F-14(スコア)の統合。
 * 原仕様 §36(UI 状態)/ §23(スコア)/ §28(Slow Motion)/ §29(Pause)。
 */

const stage = () => getStage(2);

describe("T-056 状態遷移(F-11)", () => {
  it("READY から始まり、部品を置くと EDITING、開始すると RUNNING", () => {
    const g = createGame(stage());
    expect(g.status).toBe("READY");

    g.place("a", "board", 186.52, 179.22, 0.43);
    expect(g.status).toBe("EDITING");

    g.start();
    expect(g.status).toBe("RUNNING");
  });

  it("Pause で止まり、Resume で戻る。止まっている間は時間が進まない", () => {
    const g = createGame(stage());
    g.place("a", "board", 186.52, 179.22, 0.43);
    g.start();
    g.advance(30);

    const t = g.elapsedTicks;
    g.pause();
    expect(g.status).toBe("PAUSED");

    g.advance(60);
    expect(g.elapsedTicks).toBe(t);

    g.resume();
    expect(g.status).toBe("RUNNING");
    g.advance(10);
    expect(g.elapsedTicks).toBe(t + 10);
  });

  it("同梱解答を置いて走らせるとクリアする", () => {
    const s = stage();
    const g = createGame(s);
    for (const p of s.solution) g.place(p.id, p.kind, p.x, p.y, p.angle);
    g.start();
    g.runToEnd();

    expect(g.status).toBe("CLEAR");
    expect(g.score).not.toBeNull();
  });
});

describe("T-057 Reset(F-11 / 原仕様 §23)", () => {
  it("リセットすると時間が戻り、回数が増え、配置は残る", () => {
    const g = createGame(stage());
    g.place("a", "board", 186.52, 179.22, 0.43);
    g.start();
    g.advance(60);

    g.reset();
    expect(g.elapsedTicks).toBe(0);
    expect(g.resetCount).toBe(1);
    expect(g.status).toBe("EDITING");
    // 置いた部品は消えない —— 消すと「やり直し」ではなく「作り直し」になる。
    expect(g.placements).toHaveLength(1);
  });

  it("リセット回数がスコアに効く(原仕様 §23: ResetPenalty = 回数 × 30)", () => {
    const s = stage();

    const clean = createGame(s);
    for (const p of s.solution) clean.place(p.id, p.kind, p.x, p.y, p.angle);
    clean.start();
    clean.runToEnd();

    const messy = createGame(s);
    for (const p of s.solution) messy.place(p.id, p.kind, p.x, p.y, p.angle);
    messy.start();
    messy.advance(20);
    messy.reset();
    messy.start();
    messy.runToEnd();

    expect(clean.status).toBe("CLEAR");
    expect(messy.status).toBe("CLEAR");
    expect(messy.score!.resetPenalty).toBe(30);
    expect(messy.score!.total).toBe(clean.score!.total - 30);
  });
});

describe("T-058 Slow Motion は物理を変えない(F-11 / SPEC D-07)", () => {
  it("等速と 0.25 倍で、同じ tick 数進めた結果が一致する", () => {
    const s = stage();

    const normal = createGame(s);
    const slow = createGame(s);
    for (const p of s.solution) {
      normal.place(p.id, p.kind, p.x, p.y, p.angle);
      slow.place(p.id, p.kind, p.x, p.y, p.angle);
    }

    slow.setTimeScale(TIME_SCALES.ultraSlow);
    normal.start();
    slow.start();

    normal.advance(240);
    slow.advance(240);

    // 進めた tick 数が同じなら、見せる速さが違っても状態は同じ。
    expect(slow.ballState().x).toBe(normal.ballState().x);
    expect(slow.ballState().y).toBe(normal.ballState().y);
  });

  it("1 フレームあたりに進める tick 数のほうが変わる", () => {
    const g = createGame(stage());
    expect(g.ticksForFrame(1)).toBe(1);

    g.setTimeScale(TIME_SCALES.slow);
    // 0.5 倍なら 2 フレームで 1 tick。
    expect(g.ticksForFrame(1)).toBe(0);
    expect(g.ticksForFrame(2)).toBe(1);
  });
});

describe("T-059 ツールの上限を超えて置けない(F-09)", () => {
  it("上限に達したら place が拒否される", () => {
    const g = createGame(stage()); // stage02 は board 2 枚
    g.place("a", "board", 200, 200, 0);
    g.place("b", "board", 300, 300, 0);
    expect(g.canPlace("board")).toBe(false);
    expect(() => g.place("c", "board", 400, 400, 0)).toThrow();
  });

  it("削除すると枠が戻る", () => {
    const g = createGame(stage());
    g.place("a", "board", 200, 200, 0);
    g.place("b", "board", 300, 300, 0);
    g.remove("a");
    expect(g.canPlace("board")).toBe(true);
    expect(g.placements).toHaveLength(1);
  });
});
