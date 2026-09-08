import { describe, it, expect } from "vitest";

import { computeScore, rankFor } from "@/game/scoreManager";
import { RANK_THRESHOLDS } from "@/lib/constants";

/**
 * G-06 — Physics Score とランク。
 *
 * 期待値の出所: 原仕様 §23(式)と §24(ランクの帯)。**仕様の条項であって実測ではない。**
 *
 *   Score = 1000 − elapsedSeconds×5 − usedObjects×20 − resetCount×30
 *   900-1000 GOLD / 700-899 SILVER / 400-699 BRONZE / 0-399 CLEAR
 */

const thresholds = RANK_THRESHOLDS;

describe("T-024 スコアの式が原仕様 §23 と一致する(G-06)", () => {
  it("内訳と合計が式どおりに出る", () => {
    const s = computeScore({ elapsedSeconds: 10, usedObjects: 3, resetCount: 2 });

    expect(s.base).toBe(1000);
    expect(s.timePenalty).toBe(50); // 10 × 5
    expect(s.objectPenalty).toBe(60); // 3 × 20
    expect(s.resetPenalty).toBe(60); // 2 × 30
    expect(s.total).toBe(1000 - 50 - 60 - 60);
  });

  it("減点が無ければ満点になる", () => {
    expect(computeScore({ elapsedSeconds: 0, usedObjects: 0, resetCount: 0 }).total).toBe(1000);
  });

  it("合計は 0 を下回らない", () => {
    // 原仕様 §24 の最下位帯が 0-399 なので、負のスコアは帯の外に出てしまう。
    const s = computeScore({ elapsedSeconds: 1000, usedObjects: 50, resetCount: 50 });
    expect(s.total).toBe(0);
  });

  it("経過秒は切り上げない — 端数のぶんだけ減る", () => {
    // 秒は tick から導く連続量なので、丸め方を決めておかないと
    // 同じ操作が別の点になる。仕様に丸めの指定が無いので切り捨てを採る(SPEC D-09)。
    expect(computeScore({ elapsedSeconds: 10.9, usedObjects: 0, resetCount: 0 }).timePenalty).toBe(50);
  });
});

describe("T-025 ランクの境界が原仕様 §24 どおり(G-06)", () => {
  const cases: [number, string][] = [
    [1000, "GOLD"],
    [thresholds.gold, "GOLD"], // 900 は GOLD 側
    [thresholds.gold - 1, "SILVER"], // 899 は SILVER
    [thresholds.silver, "SILVER"], // 700 は SILVER 側
    [thresholds.silver - 1, "BRONZE"], // 699 は BRONZE
    [thresholds.bronze, "BRONZE"], // 400 は BRONZE 側
    [thresholds.bronze - 1, "CLEAR"], // 399 は CLEAR
    [0, "CLEAR"],
  ];

  for (const [score, rank] of cases) {
    it(`${score} 点は ${rank}`, () => {
      expect(rankFor(score, thresholds)).toBe(rank);
    });
  }

  it("ステージごとのしきい値を使う(SPEC D-03)", () => {
    // しきい値はステージ JSON が正本。既定値と違う面でも境界が正しく動くこと。
    const custom = { gold: 950, silver: 800, bronze: 500 };
    expect(rankFor(949, custom)).toBe("SILVER");
    expect(rankFor(950, custom)).toBe("GOLD");
    expect(rankFor(499, custom)).toBe("CLEAR");
  });
});
