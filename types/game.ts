/**
 * ゲーム進行の型。
 *
 * 出所: 原仕様 §23(Physics Score)/ §24(ランク)/ §25(追加評価)/
 * §36(UI 状態)/ §37(LocalStorage)/ §38(アンロック)。
 */

/** 原仕様 §36。 */
export type GameStatus = "READY" | "EDITING" | "RUNNING" | "PAUSED" | "CLEAR" | "FAILED";

/** 原仕様 §24。CLEAR はランクの最下位であって「未クリア」ではない。 */
export type Rank = "GOLD" | "SILVER" | "BRONZE" | "CLEAR";

/**
 * スコアの内訳(原仕様 §23)。
 *
 * 合計だけでなく内訳を持つのは、画面(原仕様 §25)が
 * CLEAR TIME / OBJECTS USED / RESET COUNT を別々に出すためである。
 * 表示のために再計算すると、表示と判定がずれる余地ができる。
 */
export interface ScoreBreakdown {
  base: number;
  timePenalty: number;
  objectPenalty: number;
  resetPenalty: number;
  /** 各ペナルティを引いた結果。負にはしない(下限 0)。 */
  total: number;
  rank: Rank;
}

/** スコア算出の入力。tick ではなく秒で受けるのは原仕様 §23 の式に合わせるため。 */
export interface ScoreInput {
  elapsedSeconds: number;
  usedObjects: number;
  resetCount: number;
}

/** 1 ステージの成績。LocalStorage に載る形(原仕様 §37)。 */
export interface StageRecord {
  bestScore: number;
  rank: Rank;
}

/** 原仕様 §37 の保存内容。個人情報は持たない(SPEC N-04)。 */
export interface SaveData {
  /** 到達済みの最大ステージ番号。原仕様 §38 の初期状態は 1。 */
  unlockedStage: number;
  /** ステージ番号(文字列キー)→ ベストスコア。原仕様 §37 の `bestScores`。 */
  bestScores: Record<string, number>;
  settings: {
    sound: boolean;
    slowMotion: boolean;
  };
}

/** 原仕様 §39 のステージ選択画面に出す状態。 */
export type StageSelectState = "GOLD" | "SILVER" | "BRONZE" | "CLEAR" | "NEW" | "LOCKED";

/** クリア判定の結果。 */
export interface ClearResult {
  status: Extract<GameStatus, "CLEAR" | "FAILED" | "RUNNING">;
  /** 経過 tick。時間は tick で数える(SPEC D-05)。 */
  elapsedTicks: number;
  /** ゴール滞在の連続 tick 数。18 tick で CLEAR(SPEC D-05 / 原仕様 §16)。 */
  goalDwellTicks: number;
}
