import { Simulation } from "@/physics/world";
import type { Placement, ToolKind } from "@/types/physics";
import type { Stage } from "@/types/stage";

/**
 * 解答の探索。**出荷物ではない** —— 面を作るときと G-01 を確かめるときにだけ使う。
 *
 * 原仕様 §5 が V1.0 の対象外とした「AI Solver」は、遊ぶ人に解を見せる機能のことである。
 * これはそれとは別で、**配る面が解けることを作者が確かめるための道具**にあたる。
 * 画面にも出荷物にも入らない。
 *
 * 探索は出荷エンジン(`Simulation`)をそのまま回す。別の近似で探すと、
 * 「探索器では解けるが本物では解けない」面を配ることになる(HC-065)。
 */

/** 決定論のための線形合同法。`Math.random` を使うと探索が再現しない。 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // Numerical Recipes の定数。品質より再現性が目的である。
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 1 個ぶんの探索範囲。 */
export interface SearchSpec {
  kind: ToolKind;
  x: [number, number];
  y: [number, number];
  angle: [number, number];
  params?: Record<string, number>;
}

export interface SearchOptions {
  seed?: number;
  samples?: number;
  /** 1 回の試行で進める最大 tick。制限時間より短く切って探索を速くする。 */
  maxTicks?: number;
}

export interface SearchResult {
  solution: Placement[] | null;
  tried: number;
  /** 見つかった解での到達 tick(見つからなければ null)。 */
  clearedAtTick: number | null;
}

/**
 * 与えた範囲から配置を無作為に選び、CLEAR に到達する組を探す。
 *
 * 見つからないことは「解が無い」を意味しない —— 探索の網が粗いだけかもしれない。
 * この非対称は G-01 の主張(片側健全)と同じである(SPEC O-1)。
 */
export function searchSolution(
  stage: Stage,
  specs: SearchSpec[],
  opts: SearchOptions = {},
): SearchResult {
  const rng = makeRng(opts.seed ?? 20260908);
  const samples = opts.samples ?? 4000;
  const maxTicks = opts.maxTicks ?? 900;

  /**
   * 候補は**保存する粒度に丸めてから**試す。
   *
   * これを怠ると、探索が確かめた配置と面データに書く配置が別物になる。
   * G-02 で 1e-12 の摂動が軌跡を変えることを実証しているので、
   * 小数 2 桁の丸めは十分に結果を変える —— 実際 stage11 / 15 / 20 で、
   * 探索は CLEAR、保存解答は FAILED になった(VERIF-FALSE、loop_004)。
   *
   * **確かめた物と配る物を同じにする。** 丸めを後段に置いてはならない。
   */
  const pick = (range: [number, number]) =>
    Math.round((range[0] + rng() * (range[1] - range[0])) * 100) / 100;

  for (let i = 0; i < samples; i++) {
    const placements: Placement[] = specs.map((spec, j) => ({
      id: `p${j + 1}`,
      kind: spec.kind,
      x: pick(spec.x),
      y: pick(spec.y),
      angle: pick(spec.angle),
      params: spec.params,
    }));

    const sim = new Simulation({ stage, placements });
    const result = sim.runUntilSettled(maxTicks);

    if (result.status === "CLEAR") {
      return { solution: placements, tried: i + 1, clearedAtTick: result.elapsedTicks };
    }
  }

  return { solution: null, tried: samples, clearedAtTick: null };
}

/** 保存済みの解答が本当に CLEAR に到達するか(G-01 の本体)。 */
export function verifySolution(stage: Stage): {
  cleared: boolean;
  ticks: number;
  status: string;
} {
  const sim = new Simulation({ stage, placements: stage.solution });
  const result = sim.runUntilSettled();

  return { cleared: result.status === "CLEAR", ticks: result.elapsedTicks, status: result.status };
}

/** 座標を面データに載せられる粒度へ丸める(小数以下 2 桁)。 */
export function roundPlacement(p: Placement): Placement {
  const r = (v: number) => Math.round(v * 100) / 100;
  return { ...p, x: r(p.x), y: r(p.y), angle: r(p.angle) };
}
