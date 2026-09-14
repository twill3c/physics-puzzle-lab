import { describe, it } from "vitest";

import { getStage } from "@/game/stageManager";
import { Simulation } from "@/physics/world";
import { GOAL_DWELL_TICKS, TICKS_PER_SECOND } from "@/lib/constants";
import type { Placement } from "@/types/physics";
import { jitterPlacements, makeRng } from "../helpers/robust";

/**
 * 置き損ねた試行が**どう外れるか**を測る(G-15 を割った面を直す前の診断)。
 * 出荷物でも常設の検査でもない —— `DIAG=1` のときだけ走り、標準出力に要約を出す。
 *
 * `runUntilSettled` は「落ちた」と「時間切れ」をどちらも FAILED にまとめるので、
 * ここでは 1 tick ずつ進めて区別する。あわせて、ゴールに入ったが 18 tick 留まれずに
 * 出ていった(滞在の最大値が 1〜17)かどうかを見る。これで直すべき形が決まる:
 * 手前で止まるなら傾き・距離、行き過ぎて跳ね出るなら受け止め、落ちるなら縁。
 *
 * 物差しは G-15 と分ける(選ぶときと同じ種 424242・±2.2px)。
 * 直した面の合否は、あとで G-15 が元の種と ±1.1px で決める。
 */

const DIAG_SEED = 424242;
const DIAG_DELTA = 2.2;
const DIAG_TRIALS = 32;

/** 反復探索(loop_010)で選ぶ物差しの最良だった配置。面データにはまだ入れていない。 */
const CANDIDATES: Record<number, Placement[]> = {
  7: [{ id: "p1", kind: "board", x: 230.55, y: 204.14, angle: 0.46 }],
  12: [
    { id: "p1", kind: "board", x: 165.19, y: 246.2, angle: 0.51 },
    { id: "p2", kind: "board", x: 307.51, y: 330.49, angle: 0.07 },
  ],
  14: [{ id: "p1", kind: "block", x: 551.15, y: 127.74, angle: 0.14 }],
  // 盤面全体の探索のあと(ゴールを広げた後)の最良。
  20: [
    { id: "p1", kind: "board", x: 192.59, y: 92.2, angle: 0.17 },
    { id: "p2", kind: "board", x: 825.13, y: 392.17, angle: -0.21 },
  ],
};

/** 落ちた試行の経路を何本まで出すか。60 tick(1 秒)ごとにボールの位置を拾う。 */
const PATHS_PER_STAGE = 3;

type Outcome = "CLEAR" | "落下" | "時間切れ";

interface Trial {
  outcome: Outcome;
  tick: number;
  peakDwell: number;
  minGoalDist: number;
  end: { x: number; y: number };
  /** 60 tick ごとのボールの位置(整数に丸める)。 */
  path: [number, number][];
}

function runTrial(stageId: number, placements: Placement[]): Trial {
  const stage = getStage(stageId);
  const sim = new Simulation({ stage, placements });
  const maxTicks = Math.ceil(stage.timeLimit * TICKS_PER_SECOND);
  const g = stage.goal;

  let peakDwell = 0;
  let minGoalDist = Infinity;
  const path: [number, number][] = [];

  while (sim.status === "RUNNING" && sim.tick < maxTicks) {
    sim.step();
    peakDwell = Math.max(peakDwell, sim.goalDwellTicks);
    const b = sim.ballState();
    minGoalDist = Math.min(minGoalDist, Math.hypot(b.x - g.x, b.y - g.y));
    if (sim.tick % TICKS_PER_SECOND === 0) path.push([Math.round(b.x), Math.round(b.y)]);
  }

  const b = sim.ballState();
  const outcome: Outcome =
    sim.status === "CLEAR" ? "CLEAR" : sim.status === "FAILED" ? "落下" : "時間切れ";

  return { outcome, tick: sim.tick, peakDwell, minGoalDist, end: { x: b.x, y: b.y }, path };
}

describe.runIf(process.env.DIAG === "1")("置き損ねの外れ方", () => {
  for (const [idText, solution] of Object.entries(CANDIDATES)) {
    const id = Number(idText);

    it(`stage${String(id).padStart(2, "0")}`, () => {
      const stage = getStage(id);
      const g = stage.goal;
      const rng = makeRng(DIAG_SEED + id);

      const trials: Trial[] = [];
      for (let i = 0; i < DIAG_TRIALS; i++) {
        trials.push(runTrial(id, jitterPlacements(solution, DIAG_DELTA, rng)));
      }

      const byOutcome: Record<Outcome, number> = { CLEAR: 0, 落下: 0, 時間切れ: 0 };
      for (const t of trials) byOutcome[t.outcome] += 1;

      const misses = trials.filter((t) => t.outcome !== "CLEAR");
      const bouncedOut = misses.filter((t) => t.peakDwell > 0).length;

      // ゴールの箱に対して、外れた試行のボールがどこで終わったか。
      const side = (t: Trial) => {
        const left = g.x - g.width / 2;
        const right = g.x + g.width / 2;
        const top = g.y - g.height / 2;
        if (t.end.y > 540) return "画面外(下)";
        if (t.end.x < left) return "ゴールの左";
        if (t.end.x > right) return "ゴールの右";
        if (t.end.y < top) return "ゴールの上";
        return "ゴールの中(留まれず)";
      };
      const sides: Record<string, number> = {};
      for (const t of misses) sides[side(t)] = (sides[side(t)] ?? 0) + 1;

      const r1 = (v: number) => Math.round(v * 10) / 10;
      console.log(
        "DIAG " +
          JSON.stringify({
            id,
            name: stage.name,
            goal: g,
            dwellNeeded: GOAL_DWELL_TICKS,
            outcomes: byOutcome,
            bouncedOutOfGoal: bouncedOut,
            missEnd: sides,
            missDetail: misses.map((t) => ({
              o: t.outcome,
              tick: t.tick,
              dwell: t.peakDwell,
              near: r1(t.minGoalDist),
              end: [r1(t.end.x), r1(t.end.y)],
            })),
            fallPaths: misses
              .filter((t) => t.outcome === "落下")
              .slice(0, PATHS_PER_STAGE)
              .map((t) => t.path),
          }),
      );
    }, 600_000);
  }

  /**
   * Domino の同梱解答が**牌を倒して**クリアしているか。
   * 面の主題は「倒れた牌は、次の牌へ勢いを渡す」なので、置き直した解答が牌を迂回して
   * ゴールへ届くなら、G-15 は通っても面の意味が失われる。解答どおりに走らせ、
   * 各牌の最終角度と、元の位置からの移動量を出す。
   */
  it("stage12 の解答で牌が倒れるか(現在の同梱解答と、loop_004 で作った元の解答)", () => {
    const stage = getStage(12);
    const original: Placement[] = [
      { id: "p1", kind: "board", x: 185.01, y: 236.15, angle: 0.4 },
      { id: "p2", kind: "board", x: 303.11, y: 313.42, angle: 0.21 },
    ];
    const r2 = (v: number) => Math.round(v * 100) / 100;

    for (const [label, placements] of [
      ["current", stage.solution],
      ["original", original],
    ] as const) {
      const sim = new Simulation({ stage, placements });
      const before = ["d1", "d2", "d3", "d4"].map((id) => sim.objectState(id));
      const result = sim.runUntilSettled();
      const after = ["d1", "d2", "d3", "d4"].map((id) => sim.objectState(id));

      console.log(
        "DOMINO " +
          JSON.stringify({
            label,
            status: result.status,
            ticks: result.elapsedTicks,
            dominoes: after.map((a, i) => ({
              id: `d${i + 1}`,
              angle: r2(a.angle),
              moved: r2(Math.hypot(a.x - before[i].x, a.y - before[i].y)),
            })),
          }),
      );
    }
  });
});
