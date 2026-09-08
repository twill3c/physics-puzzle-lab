import { describe, it, expect } from "vitest";

import { createRecorder, placementsFromEvents, replayRun } from "@/game/replayManager";
import { getStage } from "@/game/stageManager";
import { Simulation } from "@/physics/world";
import { computeScore } from "@/game/scoreManager";

/**
 * G-03 — リプレイ忠実度(SPEC O-3)。
 *
 * 原仕様 §26 は「動画を作らず操作ログを保存して再実行する」方式を定めている。
 * 再実行が記録元と同じ結果を出せるのは、物理が固定タイムステップで回っているからである
 * (SPEC D-01)。可変 delta のままログを再生しても、同じ操作から同じ軌跡は出ない。
 *
 * 主張するのは**最終状態とスコアの一致**であって、描画の一致ではない。
 */

/** 記録つきで 1 回遊ぶ。編集して、動かして、片付けて、開始する。 */
function playSession() {
  const stage = getStage(2);
  const rec = createRecorder(stage.id);

  rec.create("a", "board", 300, 200, 0.3);
  rec.create("b", "board", 500, 350, 0.1);
  rec.move("a", 186.52, 179.22);
  rec.rotate("a", 0.43);
  rec.create("c", "board", 700, 400, 0);
  rec.delete("c");
  rec.move("b", 334.93, 368.58);
  rec.rotate("b", 0.25);
  rec.start();

  return { stage, replay: rec.build() };
}

describe("T-050 操作ログから配置を復元できる(G-03)", () => {
  it("CREATE / MOVE / ROTATE / DELETE を畳んだ結果が最終配置になる", () => {
    const { replay } = playSession();
    const placements = placementsFromEvents(replay.events);

    // 消した c は残らない。
    expect(placements.map((p) => p.id).sort()).toEqual(["a", "b"]);

    // 最後の MOVE / ROTATE が効いている。
    const a = placements.find((p) => p.id === "a")!;
    expect(a.x).toBe(186.52);
    expect(a.angle).toBe(0.43);
  });

  it("復元した配置は、その面の同梱解答と一致する", () => {
    // この操作列は stage02 の解答をなぞって組んである。
    // 復元器が正しければ、同梱解答と同じ配置に落ち着く。
    const { stage, replay } = playSession();
    const restored = placementsFromEvents(replay.events);

    for (const sol of stage.solution) {
      const got = restored.find((p) => p.id === (sol.id === "p1" ? "a" : "b"))!;
      expect(got.x).toBe(sol.x);
      expect(got.y).toBe(sol.y);
      expect(got.angle).toBe(sol.angle);
    }
  });
});

describe("T-051 再生が記録元と同じ最終状態・同じスコアを生む(G-03)", () => {
  it("最終状態が全項目で一致する", () => {
    const { stage, replay } = playSession();

    // 記録元: 復元した配置でそのまま走らせる
    const live = new Simulation({ stage, placements: placementsFromEvents(replay.events) });
    const liveResult = live.runUntilSettled();
    const liveBall = live.ballState();

    // 再生: ログだけを渡して走らせる
    const replayed = replayRun(stage, replay);

    expect(replayed.status).toBe(liveResult.status);
    expect(replayed.elapsedTicks).toBe(liveResult.elapsedTicks);
    expect(replayed.ball.x).toBe(liveBall.x);
    expect(replayed.ball.y).toBe(liveBall.y);
    expect(replayed.ball.vx).toBe(liveBall.vx);
    expect(replayed.ball.vy).toBe(liveBall.vy);

    // 走査が空でないこと(実際にクリアまで進んでいる)。
    expect(replayed.status).toBe("CLEAR");
  });

  it("スコアが一致する", () => {
    const { stage, replay } = playSession();
    const replayed = replayRun(stage, replay);

    const expected = computeScore(
      {
        elapsedSeconds: replayed.elapsedTicks / 60,
        usedObjects: replayed.usedObjects,
        resetCount: replayed.resetCount,
      },
      stage.score,
    );

    expect(replayed.score.total).toBe(expected.total);
    expect(replayed.score.rank).toBe(expected.rank);
    // 置いた 2 枚だけが数えられる(消した c は数えない)。
    expect(replayed.usedObjects).toBe(2);
  });

  it("RESET はリセット回数として数えられる", () => {
    const stage = getStage(2);
    const rec = createRecorder(stage.id);
    rec.create("a", "board", 186.52, 179.22, 0.43);
    rec.create("b", "board", 334.93, 368.58, 0.25);
    rec.start();
    rec.reset();
    rec.start();

    const replayed = replayRun(stage, rec.build());
    expect(replayed.resetCount).toBe(1);
    // 原仕様 §23: ResetPenalty = resetCount × 30
    expect(replayed.score.resetPenalty).toBe(30);
  });
});

describe("T-052 リプレイ検査そのものの検査 — 陽性対照(G-03)", () => {
  it("ログを 1 件削ると結果が変わる", () => {
    // HC-041: 一致検査は「本当に一致しているとき」と「比較が働いていないとき」で
    // 同じ緑を返す。ログを壊したら落ちることを確かめて、比較が効いていると言う。
    const { stage, replay } = playSession();

    const rotateIndex = replay.events.findIndex((e) => e.type === "ROTATE");
    expect(rotateIndex).toBeGreaterThanOrEqual(0);

    const damaged = {
      ...replay,
      events: replay.events.filter((_, i) => i !== rotateIndex),
    };

    const good = replayRun(stage, replay);
    const bad = replayRun(stage, damaged);

    expect(good.status).toBe("CLEAR");
    expect(bad.ball.x === good.ball.x && bad.ball.y === good.ball.y).toBe(false);
  });

  it("配置を 1 px ずらしたログは別の結果になる", () => {
    const { stage, replay } = playSession();
    const shifted = {
      ...replay,
      events: replay.events.map((e) =>
        e.type === "MOVE" && e.x !== undefined ? { ...e, x: e.x + 1 } : e,
      ),
    };

    const good = replayRun(stage, replay);
    const bad = replayRun(stage, shifted);

    expect(bad.ball.x === good.ball.x && bad.ball.y === good.ball.y).toBe(false);
  });
});
