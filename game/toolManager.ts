import { TOOL_KINDS } from "@/types/physics";
import type { ToolKind } from "@/types/physics";
import type { Stage } from "@/types/stage";

/**
 * Tool Palette の個数管理。原仕様 §19 / §20。
 *
 * 状態は**不変**に扱う(置く・消すたびに新しい状態を返す)。
 * Replay(原仕様 §26)は操作列を再生して同じ状態に到達することを要求するので、
 * 途中の状態を書き換えると、記録と再生が同じ経路を辿らなくなる。
 */

export interface ToolState {
  /** 種別ごとの上限。ステージの `tools`(原仕様 §20)。 */
  readonly limits: Readonly<Record<ToolKind, number>>;
  /** 置いた配置 id → 種別。順序は挿入順を保つ。 */
  readonly placed: ReadonlyMap<string, ToolKind>;
}

export function createToolState(stage: Stage): ToolState {
  return { limits: { ...stage.tools }, placed: new Map() };
}

/** その種別をあと 1 個置けるか。 */
export function canPlace(state: ToolState, kind: ToolKind): boolean {
  return countOf(state, kind) < state.limits[kind];
}

/** 種別ごとの使用数。 */
export function countOf(state: ToolState, kind: ToolKind): number {
  let n = 0;
  for (const k of state.placed.values()) {
    if (k === kind) n += 1;
  }
  return n;
}

/**
 * 置いた総数。原仕様 §23 の `usedObjects` にそのまま渡す数である。
 * ステージの固定物は含まない。
 */
export function usedCount(state: ToolState): number {
  return state.placed.size;
}

/**
 * 1 個置く。
 *
 * 上限を超える配置は**例外にする**。黙って無視すると、UI では置けたように見えて
 * 物理には入らない、という食い違いが起きる(HC-075: 仮定が崩れたら落ちる)。
 * 置けるかどうかは呼ぶ側が `canPlace` で先に確かめること。
 */
export function place(state: ToolState, kind: ToolKind, id: string): ToolState {
  if (!canPlace(state, kind)) {
    throw new Error(`${kind} は上限 ${state.limits[kind]} 個に達している`);
  }
  if (state.placed.has(id)) {
    throw new Error(`配置 id "${id}" は既に使われている`);
  }

  const placed = new Map(state.placed);
  placed.set(id, kind);
  return { limits: state.limits, placed };
}

/** 1 個消す。存在しない id は何もしない(削除は冪等でよい)。 */
export function remove(state: ToolState, id: string): ToolState {
  if (!state.placed.has(id)) return state;

  const placed = new Map(state.placed);
  placed.delete(id);
  return { limits: state.limits, placed };
}

/** 画面に出すための残数一覧。 */
export function remaining(state: ToolState): Record<ToolKind, number> {
  const out = {} as Record<ToolKind, number>;
  for (const kind of TOOL_KINDS) {
    out[kind] = state.limits[kind] - countOf(state, kind);
  }
  return out;
}
