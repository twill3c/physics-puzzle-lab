import type { ToolKind } from "./physics";

/**
 * Replay の型。
 *
 * 出所: 原仕様 §26 / §27。V1.0 は動画を作らず、操作ログを保存して再実行する。
 *
 * 再実行が記録元と同じ結果を出すこと(SPEC の G-03)が成立するのは、
 * 物理が固定タイムステップで回っているからである(SPEC D-01)。
 * 可変 delta のままログを再生しても、同じ操作から同じ軌跡は出ない。
 */
export type ReplayEventType = "MOVE" | "ROTATE" | "CREATE" | "DELETE" | "START" | "RESET";

export interface ReplayEvent {
  /**
   * 記録元の時刻。原仕様 §27 の例は ms で書かれている。
   * 再生は tick で行うため、読み込み時に tick へ丸める(SPEC D-05)。
   */
  timestamp: number;
  type: ReplayEventType;
  objectId?: string;
  /** CREATE のときに必要。どの種別を作るか。 */
  kind?: ToolKind;
  x?: number;
  y?: number;
  angle?: number;
}

export interface Replay {
  stageId: number;
  events: ReplayEvent[];
}
