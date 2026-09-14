import { describe, it, expect } from "vitest";

import { allStages } from "@/game/stageManager";
import {
  CONTROL_DELTA,
  FINGER_DELTA,
  MIN_CLEAR_RATE,
  TRIALS,
  clearRate,
  jitterPlacements,
} from "../helpers/robust";

/**
 * G-15 — 指で届く精度で置いても解ける(SPEC G-15)。
 *
 * G-01 は「厳密な座標なら解ける」までしか言わない。遊ぶ人は小数 2 桁の座標を狙えないので、
 * 解答の周りに**置き損ねても解ける幅**が無ければ、配った面は実質的には解けない。
 * 合格線・ずれ・試行回数は loop_010 で測る前に固定した(`tests/helpers/robust.ts`)。
 */

const LONG = 600_000;
const withTools = allStages().filter((s) => s.solution.length > 0);

describe("T-074 指で届く精度で置いても解ける(G-15)", () => {
  it("検査の対象が空でない", () => {
    expect(withTools.length).toBeGreaterThan(10);
  });

  for (const stage of withTools) {
    const name = `stage${String(stage.id).padStart(2, "0")} ${stage.name}`;
    it(
      `${name}: ±${FINGER_DELTA}px のずれで ${MIN_CLEAR_RATE * 100}% 以上が CLEAR`,
      () => {
        const r = clearRate(stage, FINGER_DELTA);
        expect(r.trials).toBe(TRIALS);
        expect(r.rate, `${name} は ${r.cleared}/${r.trials}`).toBeGreaterThanOrEqual(MIN_CLEAR_RATE);
      },
      LONG,
    );
  }
});

describe("T-075 頑健さの検査そのものの検査 — 陽性対照(G-15)", () => {
  it(
    `±${CONTROL_DELTA}px までずらすと合格線を割る面がある`,
    () => {
      // ずれを見分けられない検査(ずれが物理に届いていない・判定が常に CLEAR)は、
      // T-074 を無条件に緑にする。大きくずらして落ちることを確かめる。
      const low = withTools
        .map((s) => ({ id: s.id, r: clearRate(s, CONTROL_DELTA, { trials: 8 }) }))
        .filter((x) => x.r.rate < MIN_CLEAR_RATE);
      expect(low.length).toBeGreaterThan(0);
    },
    LONG,
  );
});

describe("T-076 ずれの入れ方が解答そのものを壊していない — 陰性対照(G-15)", () => {
  it("δ = 0 なら全面が全試行で CLEAR(G-01 と一致する)", () => {
    for (const stage of withTools) {
      const r = clearRate(stage, 0, { trials: 2 });
      expect(r.cleared, `stage${stage.id}`).toBe(2);
    }
  }, LONG);

  it("ずれは x・y だけに入り、各成分が ±δ に収まり、角度と種類は変わらない", () => {
    const stage = withTools[0];
    let s = 1;
    const rng = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    const moved = jitterPlacements(stage.solution, 3, rng);
    moved.forEach((p, i) => {
      const o = stage.solution[i];
      expect(Math.abs(p.x - o.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(p.y - o.y)).toBeLessThanOrEqual(3);
      expect(p.angle).toBe(o.angle);
      expect(p.kind).toBe(o.kind);
    });
    // 本当に動いていること(ずれが 0 に潰れていない)。
    expect(moved.some((p, i) => p.x !== stage.solution[i].x)).toBe(true);
  });
});

/**
 * 記述: δ ごとの CLEAR 率の表。**合否には使わない**(事前登録で決めた)。
 * 重いので `ROBUST_REPORT=1` のときだけ走らせる。
 */
describe.runIf(process.env.ROBUST_REPORT === "1")("記述: r(δ) の表", () => {
  it(
    "δ = 0.5 / 1.1 / 2.2 / 4.4 / 8.8",
    () => {
      const deltas = [0.5, 1.1, 2.2, 4.4, 8.8];
      const lines = [`stage | ${deltas.map((d) => `δ=${d}`).join(" | ")}`];
      for (const stage of withTools) {
        const cells = deltas.map((d) => {
          const r = clearRate(stage, d);
          return `${r.cleared}/${r.trials}`;
        });
        lines.push(`${String(stage.id).padStart(2, "0")} ${stage.name} | ${cells.join(" | ")}`);
      }
      console.log("ROBUST_TABLE\n" + lines.join("\n"));
    },
    3_600_000,
  );
});
