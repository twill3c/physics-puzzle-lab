import { describe, it, expect } from "vitest";
import Matter from "matter-js";

import { allStages, getStage, loadStage, stageCount } from "@/game/stageManager";
import { validateStage } from "@/game/validation";
import { Simulation } from "@/physics/world";
import { MAX_BODIES_PER_STAGE, MAX_CONSTRAINTS_PER_STAGE } from "@/lib/constants";
import { verifySolution } from "../helpers/solve";
import { TOOL_KINDS } from "@/types/physics";

/**
 * G-01 — 解答可能性。**このプロジェクトの背骨**(SPEC O-1)。
 *
 * 各面に同梱した解答を、**出荷するのと同じエンジン**で無頭実行し、
 * 制限時間内に CLEAR へ到達することを確かめる。
 *
 * この主張は片側にしか無い —— 「解けると言えた面だけを配る」ことは言えるが、
 * 「この面は解けない」とは言えない。解答が見つからないことは、
 * 探索の網が粗いことと区別できないからである。この非対称は保つ。
 */

describe("T-040 収録全面が同梱解答で CLEAR に到達する(G-01)", () => {
  it("20 面ある", () => {
    // 原仕様 §22 / SPEC F-13。
    expect(stageCount()).toBe(20);
  });

  it("id が 1〜20 で重複なく揃っている", () => {
    const ids = allStages().map((s) => s.id);
    expect(ids).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  for (const stage of allStages()) {
    it(`stage${String(stage.id).padStart(2, "0")} ${stage.name} が解ける`, () => {
      const r = verifySolution(stage);
      expect(r.status).toBe("CLEAR");
      expect(r.cleared).toBe(true);

      // 制限時間の中で到達していること(runUntilSettled の上限は timeLimit×60)。
      expect(r.ticks).toBeLessThanOrEqual(stage.timeLimit * 60);
    });
  }

  it("解答が使う道具の数は、その面の上限を超えない", () => {
    // 「解けるが、その面では置けない配置」を同梱していないこと。
    for (const stage of allStages()) {
      for (const kind of TOOL_KINDS) {
        const used = stage.solution.filter((p) => p.kind === kind).length;
        expect(
          used,
          `stage${stage.id} の ${kind}(上限 ${stage.tools[kind]})`,
        ).toBeLessThanOrEqual(stage.tools[kind]);
      }
    }
  });
});

describe("T-041 解答可能性の検査そのものの検査 — 陽性対照(G-01)", () => {
  it("道具を置かなければクリアできない面がある", () => {
    // HC-041: 「全面クリアした」が緑になるのは、検査が働いているときと
    // 判定が壊れて何でも CLEAR を返すときの両方である。
    // **道具なしでは解けない面**を挙げ、実際に CLEAR にならないことを確かめる。
    const needsTools = allStages().filter((s) => s.solution.length > 0);

    // 走査対象が空でないこと。
    expect(needsTools.length).toBeGreaterThan(10);

    for (const stage of needsTools) {
      const sim = new Simulation({ stage, placements: [] });
      const r = sim.runUntilSettled();
      expect(r.status, `stage${stage.id} は道具なしでクリアできてしまう`).not.toBe("CLEAR");
    }
  });

  it("解答の配置をずらすとクリアしなくなる面がある", () => {
    // 解答が「たまたまどこでもよい」ものでないこと = 面に構造があること。
    let broken = 0;

    for (const stage of allStages()) {
      if (stage.solution.length === 0) continue;
      const shifted = stage.solution.map((p) => ({ ...p, x: p.x + 160, y: p.y + 90 }));
      const r = new Simulation({ stage, placements: shifted }).runUntilSettled();
      if (r.status !== "CLEAR") broken += 1;
    }

    // 全面が壊れることまでは要求しない(ずらしても解ける面はありうる)。
    // 大半が壊れることで「配置が効いている」と言える。
    expect(broken).toBeGreaterThan(10);
  });
});

describe("T-042 収録全面が検証を通る(G-05)", () => {
  it("全面が validateStage を通る", () => {
    for (const stage of allStages()) {
      const r = validateStage(stage);
      expect(r.errors, `stage${stage.id}`).toEqual([]);
    }
  });

  it("loadStage が全面を読める", () => {
    for (let id = 1; id <= 20; id++) {
      expect(() => loadStage(id)).not.toThrow();
    }
  });

  it("存在しない id は例外になる", () => {
    expect(() => getStage(0)).toThrow();
    expect(() => getStage(21)).toThrow();
  });
});

describe("T-043 性能の上限を守る(G-09)", () => {
  it("全面が Bodies <= 100 / Constraints <= 30 に収まる", () => {
    // 原仕様 §47 / SPEC N-02。解答を置いた状態(最も物体が多い状態)で数える。
    for (const stage of allStages()) {
      const sim = new Simulation({ stage, placements: stage.solution });
      const bodies = Matter.Composite.allBodies(sim.engine.world).length;
      const constraints = Matter.Composite.allConstraints(sim.engine.world).length;

      expect(bodies, `stage${stage.id} の Bodies`).toBeLessThanOrEqual(MAX_BODIES_PER_STAGE);
      expect(constraints, `stage${stage.id} の Constraints`).toBeLessThanOrEqual(
        MAX_CONSTRAINTS_PER_STAGE,
      );
    }
  });
});

describe("T-044 面の体裁(F-13)", () => {
  it("名前・テーマ・ヒントが全面にある", () => {
    for (const stage of allStages()) {
      expect(stage.name.length, `stage${stage.id}`).toBeGreaterThan(0);
      expect(stage.theme.length, `stage${stage.id}`).toBeGreaterThan(0);
      expect(stage.hint.length, `stage${stage.id}`).toBeGreaterThan(0);
    }
  });

  it("難易度が 1〜5 の範囲にあり、全体として上がっていく", () => {
    const ds = allStages().map((s) => s.difficulty);
    for (const d of ds) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(5);
    }

    // **単調増加は要求しない。** 原仕様 §22 はテーマの並びを定めているだけで、
    // 難易度が面ごとに下がらないことまでは保証していない(SPEC の保証粒度を
    // 超える期待値を書かない — HC-016)。実際 Fan(10)は Catapult(9)より易しい。
    // 主張するのは「前半より後半のほうが難しい」という全体の傾向だけにする。
    const firstHalf = ds.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const secondHalf = ds.slice(10).reduce((a, b) => a + b, 0) / 10;
    expect(secondHalf).toBeGreaterThan(firstHalf);

    expect(ds[0]).toBe(1);
    expect(ds[ds.length - 1]).toBe(5);
  });
});
