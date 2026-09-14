import { describe, it } from "vitest";

import { allStages } from "@/game/stageManager";
import { Simulation } from "@/physics/world";
import type { Placement } from "@/types/physics";
import type { Stage } from "@/types/stage";
import { FINGER_DELTA, MIN_CLEAR_RATE, TRIALS, clearRate, makeRng } from "../helpers/robust";
import { THEMES } from "../helpers/theme";
import { withinBoard } from "../helpers/bounds";

/**
 * 解答の置き直し(G-15 を割った面のための道具)。**出荷物でも常設の検査でもない** ——
 * `RESELECT=1` のときだけ走り、候補を標準出力に出すだけで面データは書き換えない。
 *
 * **選ぶ物差しと、合否を決める物差しを分ける。** 候補を G-15 と同じ種・同じ δ の 32 回で
 * 選ぶと、合格線を割らない候補を「その 32 本のずれに合わせて」選ぶことになり、
 * G-15 はもう独立な確かめにならない。そこで選ぶときは**別の種**(SELECT_SEED)で、
 * **倍の幅**(±2.2px)のずれに対する率を使う。合否はそのあと G-15 が元の種と ±1.1px で決める。
 *
 * 探索は範囲を狭めながら数回まわす。各回の中心は、それまでに選ぶ物差しで最良だった配置。
 * 初期値に敏感な面では解の多くが針の先なので、一度の広い探索では幅のある点に当たりにくい。
 *
 * 候補は保存する粒度(小数 2 桁)に丸めてから試す(loop_004 の教訓。solve.ts を参照)。
 */

const SELECT_SEED = 424242;
const SELECT_DELTA = 2.2;
const MAX_EVALS_PER_ROUND = 60;
const ROUNDS = [
  { xy: 50, angle: 0.15, candidates: 600 },
  { xy: 20, angle: 0.06, candidates: 400 },
  { xy: 8, angle: 0.03, candidates: 300 },
];

/**
 * 盤面全体を探す範囲(`RESELECT_GLOBAL=1` のとき)。近傍の探索が頭打ちになった面のためのもの。
 * 元の解答の周りに幅のある解が無くても、別の経路(高い所から落として勢いをつける等)には
 * 幅があるかもしれない。面の形を変える前に、置き場所のほうを広く当たる。
 * 範囲は解答の部品ごとに書く(順序は `stage.solution` と同じ)。
 */
type Range = [number, number];
const GLOBAL_RANGES: Record<number, { x: Range; y: Range; angle: Range }[]> = {
  12: [
    { x: [110, 330], y: [120, 330], angle: [0, 0.8] },
    { x: [200, 420], y: [200, 330], angle: [-0.1, 0.6] },
  ],
  14: [{ x: [430, 640], y: [90, 220], angle: [-0.3, 0.3] }],
  20: [
    { x: [110, 330], y: [60, 220], angle: [-0.2, 0.6] },
    { x: [600, 880], y: [380, 500], angle: [-0.4, 0.2] },
  ],
};
const GLOBAL_CANDIDATES = 4000;
const GLOBAL_EVALS = 80;

/**
 * 部品が盤面に収まり(T-078)、厳密に解け、面に主題の条件(tests/helpers/theme.ts)が
 * あればそれも満たすか。G-15 はクリアの幅しか見ないので、主題を迂回する経路
 * (Domino なら牌を飛び越える)や、見えない所へはみ出した板に頼る経路を
 * 「幅がある」として選んでしまう(loop_010 で両方とも実際に選んだ)。
 */
function acceptable(stage: Stage, placements: Placement[]): boolean {
  if (!withinBoard(placements)) return false;
  const sim = new Simulation({ stage, placements });
  const makeTheme = THEMES[stage.id];
  const theme = makeTheme ? makeTheme(sim) : null;
  if (sim.runUntilSettled().status !== "CLEAR") return false;
  return theme ? theme.holds(sim) : true;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function candidateInRanges(
  template: Placement[],
  ranges: { x: Range; y: Range; angle: Range }[],
  rng: () => number,
): Placement[] {
  const pick = (r: Range) => round2(r[0] + rng() * (r[1] - r[0]));
  return template.map((p, i) => ({ ...p, x: pick(ranges[i].x), y: pick(ranges[i].y), angle: pick(ranges[i].angle) }));
}

function candidateAround(
  center: Placement[],
  rng: () => number,
  range: { xy: number; angle: number },
): Placement[] {
  const u = () => rng() * 2 - 1;
  return center.map((p) => ({
    ...p,
    x: round2(p.x + u() * range.xy),
    y: round2(p.y + u() * range.xy),
    angle: round2(p.angle + u() * range.angle),
  }));
}

function withSolution(stage: Stage, solution: Placement[]): Stage {
  return { ...stage, solution };
}

describe.runIf(process.env.RESELECT === "1")("解答の置き直し", () => {
  const ids = (process.env.RESELECT_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const targets = allStages().filter(
    (s) => s.solution.length > 0 && (ids.length === 0 || ids.includes(s.id)),
  );

  for (const stage of targets) {
    it(
      `stage${String(stage.id).padStart(2, "0")} ${stage.name}`,
      () => {
        const rng = makeRng(SELECT_SEED + stage.id * 7919);
        const baseSel = clearRate(stage, SELECT_DELTA, { seed: SELECT_SEED });

        // 同梱解答が主題の条件を満たさないなら、出発点の成績は無いものとする(-1)。
        // さもないと、主題を迂回した同梱解答が 32/32 のまま「最良」に居座り、探索が即座に止まる。
        let best = {
          solution: stage.solution,
          sel: acceptable(stage, stage.solution) ? baseSel.cleared : -1,
        };
        const rounds: { range: number | "global"; tried: number; exactClears: number; evals: number; best: string }[] = [];

        const globalRanges = GLOBAL_RANGES[stage.id];
        if (process.env.RESELECT_GLOBAL === "1" && globalRanges) {
          if (globalRanges.length !== stage.solution.length) {
            throw new Error(`stage${stage.id} の探索範囲は ${globalRanges.length} 部品、解答は ${stage.solution.length} 部品`);
          }
          let tried = 0;
          let exactClears = 0;
          let evals = 0;
          for (; tried < GLOBAL_CANDIDATES && evals < GLOBAL_EVALS && best.sel < TRIALS; tried++) {
            const cand = candidateInRanges(stage.solution, globalRanges, rng);
            if (!acceptable(stage, cand)) continue;
            exactClears += 1;
            evals += 1;
            const sel = clearRate(withSolution(stage, cand), SELECT_DELTA, { seed: SELECT_SEED });
            if (sel.cleared > best.sel) best = { solution: cand, sel: sel.cleared };
          }
          rounds.push({ range: "global", tried, exactClears, evals, best: `${best.sel}/${TRIALS}` });
        }

        for (const round of ROUNDS) {
          if (best.sel >= TRIALS) break;
          const center = best.solution;
          let tried = 0;
          let exactClears = 0;
          let evals = 0;

          for (; tried < round.candidates && evals < MAX_EVALS_PER_ROUND && best.sel < TRIALS; tried++) {
            const cand = candidateAround(center, rng, round);
            if (!acceptable(stage, cand)) continue;
            exactClears += 1;

            evals += 1;
            const sel = clearRate(withSolution(stage, cand), SELECT_DELTA, { seed: SELECT_SEED });
            if (sel.cleared > best.sel) best = { solution: cand, sel: sel.cleared };
          }

          rounds.push({ range: round.xy, tried, exactClears, evals, best: `${best.sel}/${TRIALS}` });
        }

        // 参考として、選んだ候補を G-15 の物差し(元の種・±1.1px)でも測って出す。
        // **この数で選び直してはならない**(選ぶ物差しを分けた意味が無くなる)。
        const gate = clearRate(withSolution(stage, best.solution), FINGER_DELTA);

        console.log(
          "RESELECT " +
            JSON.stringify({
              id: stage.id,
              name: stage.name,
              before: { select: `${baseSel.cleared}/${TRIALS}` },
              rounds,
              after: {
                select: `${best.sel}/${TRIALS}`,
                gate: `${gate.cleared}/${gate.trials}`,
                gatePass: gate.rate >= MIN_CLEAR_RATE,
              },
              solution: best.solution,
            }),
        );
      },
      3_600_000,
    );
  }
});
