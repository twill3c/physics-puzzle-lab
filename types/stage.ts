import type {
  BallDefinition,
  GoalDefinition,
  PhysicsObjectDefinition,
  Placement,
  ToolKind,
} from "./physics";

/**
 * ステージ定義。
 *
 * 出所: 原仕様 §20(JSON 例)/ §21(TypeScript 型)。
 * 原仕様の型に対して V1.0 では次の 2 点を足している:
 *
 * - `solution` — このステージを CLEAR させる配置列。SPEC の G-01(解答可能性)で
 *   出荷エンジンに掛けて到達を確かめる。**同梱しないステージは配らない。**
 * - `theme` / `hint` — ステージ一覧と遊び方の表示に使う(原仕様 §22 のテーマ欄)。
 */
export interface Stage {
  id: number;
  name: string;
  /** 原仕様 §22 の難易度(★の数)。1–5。 */
  difficulty: number;
  /** 原仕様 §22 の「テーマ」欄(例: 重力、斜面、反発)。 */
  theme: string;
  /** 画面に出す一行の狙い。原仕様 §22 の「目的」欄。 */
  hint: string;

  world: {
    gravityX: number;
    gravityY: number;
  };

  ball: BallDefinition;

  goal: GoalDefinition;

  /** ステージが最初から置いている物。スコアの ObjectPenalty には数えない。 */
  fixedObjects: PhysicsObjectDefinition[];

  /** 種別ごとの使用可能個数(原仕様 §20)。0 はそのツールを使えないことを表す。 */
  tools: Record<ToolKind, number>;

  /** 制限時間(秒)。原仕様 §20。 */
  timeLimit: number;

  /** ランクしきい値。既定は原仕様 §24 の 900 / 700 / 400(SPEC D-03)。 */
  score: {
    gold: number;
    silver: number;
    bronze: number;
  };

  /**
   * G-01 用の解答。出荷エンジンで無頭実行して CLEAR に到達することを検査する。
   *
   * これは「模範解答」ではなく「解が存在することの証拠」である。
   * 画面には出さない —— 出すと答えを配ることになる。
   */
  solution: Placement[];
}

/** ステージ検証の結果(原仕様 §55)。不正値を Matter.js へ渡さないための関門。 */
export interface StageValidationResult {
  ok: boolean;
  errors: StageValidationError[];
}

export interface StageValidationError {
  /** 値の位置(例: `ball.x`, `fixedObjects[2].width`)。 */
  path: string;
  /** 何が起きたか(1 文)。 */
  message: string;
}
