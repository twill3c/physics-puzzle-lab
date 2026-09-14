import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/constants";
import { TOOL_DEFAULTS } from "@/physics/presets";
import type { Placement } from "@/types/physics";

/**
 * 置いた部品の外形が盤面(900×540)からはみ出す量。
 *
 * 解答の探索は部品の**中心**しか見ないので、板の端が盤面の外へ出た配置を選びうる
 * (loop_010 で Grand Challenge の板が右端を 59.5px 越えていた)。検査(T-078)と
 * 探索の道具(tests/tools/reselect.test.ts)が同じ定義を使うよう、ここに置く。
 *
 * 形は板と箱だけを見る(ばね・送風は体を持たない)。寸法は配置の既定値(`TOOL_DEFAULTS`)。
 */

function corners(p: Placement): { x: number; y: number }[] | null {
  const size =
    p.kind === "board" ? TOOL_DEFAULTS.board : p.kind === "block" ? TOOL_DEFAULTS.block : null;
  if (!size) return null;

  const hw = (p.params?.width ?? size.width) / 2;
  const hh = (p.params?.height ?? size.height) / 2;
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);

  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => ({ x: p.x + dx * c - dy * s, y: p.y + dx * s + dy * c }));
}

/** 盤面からはみ出す量(論理 px)。収まっていれば 0。 */
export function overflow(p: Placement): number {
  const cs = corners(p);
  if (!cs) return 0;
  let worst = 0;
  for (const { x, y } of cs) {
    worst = Math.max(worst, -x, x - CANVAS_WIDTH, -y, y - CANVAS_HEIGHT);
  }
  return Math.max(0, worst);
}

/** すべての部品が盤面に収まるか。 */
export function withinBoard(placements: Placement[]): boolean {
  return placements.every((p) => overflow(p) === 0);
}
