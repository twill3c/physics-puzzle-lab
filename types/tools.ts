import type { ToolKind } from "./physics";

/**
 * Tool Palette の型。
 *
 * 出所: 原仕様 §19(Tool Palette)/ §44(タップ操作)/ §45(キーボード)。
 */

/** パレット上の 1 種別の状態。 */
export interface ToolSlot {
  kind: ToolKind;
  /** ステージが許す総数(原仕様 §20 の `tools`)。 */
  limit: number;
  /** すでに置いた数。`limit` を超えて置けない。 */
  used: number;
}

/** 編集操作の種別(原仕様 §19)。 */
export type EditAction = "select" | "move" | "rotate" | "delete" | "deselect";

/** 現在の編集状態。 */
export interface EditorState {
  /** 選択中のツール種別。null は「選択なし」。 */
  activeTool: ToolKind | null;
  /** 選択中の配置済みオブジェクト id。null は「選択なし」。 */
  selectedId: string | null;
}

/**
 * キーボード割り当て(原仕様 §45)。
 *
 * 値は `KeyboardEvent.key` に対応させる。表示用の文字列とは分けておく ——
 * 表示を変えたときに割り当てが黙って変わらないようにするため。
 */
export const KEY_BINDINGS = {
  startPause: " ",
  reset: "r",
  delete: "Delete",
  deselect: "Escape",
  slowMotion: "s",
} as const;
