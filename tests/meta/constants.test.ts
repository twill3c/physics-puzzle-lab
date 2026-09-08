import { describe, it, expect } from "vitest";

import { CANVAS_WIDTH, CANVAS_HEIGHT, TICK_MS, TICKS_PER_SECOND } from "@/lib/constants";

/**
 * T-003 / F-01 — 論理キャンバスと固定タイムステップの定数。
 *
 * 期待値の出所: SPEC.md D-04(論理キャンバス 900×540)および D-01 / D-05
 * (固定タイムステップ 1000/60 ms・60 Hz)。仕様の条項であって実測ではない。
 */
describe("T-003 基本定数(F-01)", () => {
  it("論理キャンバスが SPEC D-04 と一致する", () => {
    expect(CANVAS_WIDTH).toBe(900);
    expect(CANVAS_HEIGHT).toBe(540);
  });

  it("固定タイムステップが SPEC D-01 / D-05 と一致する", () => {
    expect(TICKS_PER_SECOND).toBe(60);
    expect(TICK_MS).toBeCloseTo(1000 / 60, 12);
  });

  it("原仕様 §20 のステージ 01 の座標が論理キャンバスに収まる", () => {
    // 原仕様 §20: ball (100,100) / goal (700,400) 60×60。
    // D-04 の寸法がこれらを収容できることを、定数側から確かめる。
    expect(700 + 60 / 2).toBeLessThanOrEqual(CANVAS_WIDTH);
    expect(400 + 60 / 2).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });
});
