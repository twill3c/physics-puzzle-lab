import { describe, it, expect } from "vitest";

import { allStages } from "@/game/stageManager";
import type { Placement } from "@/types/physics";
import { overflow } from "../helpers/bounds";

/**
 * T-078 — 同梱解答の部品は盤面の中に収まる(G-15 の補い)。
 *
 * 解答の探索は部品の**中心**しか見ないので、板の端が盤面の外へはみ出した配置を選びうる
 * (loop_010 で Grand Challenge の板が右端を 59.5px 越えていた)。中心を画面の中でタップすれば
 * 置けるが、はみ出した部分は見えない。**見えない部分に頼る解答は、遊ぶ人に示せる解答ではない。**
 *
 * はみ出しの定義は tests/helpers/bounds.ts(探索の道具と共有)。
 */

describe("T-078 同梱解答の部品は盤面の中に収まる(G-15)", () => {
  for (const stage of allStages()) {
    if (stage.solution.length === 0) continue;
    it(`stage${String(stage.id).padStart(2, "0")} ${stage.name}`, () => {
      for (const p of stage.solution) {
        const o = overflow(p);
        expect(o, `${p.id}(${p.kind} @ ${p.x},${p.y}, ${p.angle}rad)が ${o.toFixed(1)}px はみ出す`).toBe(0);
      }
    });
  }

  it("陽性対照: 右端に寄せた板ははみ出しとして数えられ、中央の板は数えられない", () => {
    const edge: Placement = { id: "e", kind: "board", x: 868.92, y: 477.65, angle: -0.09 };
    const center: Placement = { id: "c", kind: "board", x: 450, y: 270, angle: 0.3 };
    expect(overflow(edge)).toBeGreaterThan(50);
    expect(overflow(center)).toBe(0);
  });
});
