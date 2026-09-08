/**
 * 大域定数。
 *
 * 出所: 原仕様 §10(Ball 推奨初期値)/ §17(標準世界)/ §18(重力プリセット)/
 * §23(スコア)/ §24(ランク)/ §28(Slow Motion)/ §37(LocalStorage キー)/
 * §47(性能目標)、および SPEC の D-01 / D-04 / D-05。
 *
 * ここに書く数はすべて**仕様の条項**であって実測値ではない。
 * 実測で決める値(エネルギー保存の許容差など)はここに置かない。
 */

// ── 論理キャンバス(SPEC D-04)─────────────────────────────
// 原仕様の座標例(ゴール x=700,y=400 の 60×60)が収まる最小の切りのよい寸法。
// 表示上の大きさは CSS で決め、物理と当たり判定はこの論理座標だけで行う。
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 540;

// ── 固定タイムステップ(SPEC D-01 / D-05)──────────────────
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/**
 * ゴール滞在の必要 tick 数。
 *
 * 原仕様 §16 は「300 ms 以上滞在」。60 Hz 固定なので 300 / (1000/60) = 18 tick。
 * 時間ではなく tick で数えることで判定が決定論になる(SPEC D-05)。
 */
export const GOAL_DWELL_MS = 300;
export const GOAL_DWELL_TICKS = Math.round(GOAL_DWELL_MS / TICK_MS);

// ── Ball の推奨初期値(原仕様 §10)──────────────────────────
export const BALL_DEFAULTS = {
  radius: 14,
  density: 0.001,
  friction: 0.2,
  restitution: 0.65,
} as const;

// ── 標準世界(原仕様 §17)──────────────────────────────────
export const WORLD_DEFAULTS = {
  gravityX: 0,
  gravityY: 1.0,
  friction: 0.3,
  frictionAir: 0.01,
  restitution: 0.5,
  timeScale: 1.0,
} as const;

/**
 * 重力プリセット(原仕様 §18)。
 *
 * **これは SI 単位のシミュレーションではない。** 地球を 1.0 とした相対値を
 * Matter.js の内部単位へそのまま与える教育用の近似であり、原仕様 §18 が
 * 「About ページに明記する」ことを求めている。
 */
export const GRAVITY_PRESETS = {
  earth: 1.0,
  moon: 0.165,
  mars: 0.378,
  zeroG: 0.0,
} as const;

// ── Slow Motion(原仕様 §28)───────────────────────────────
export const TIME_SCALES = {
  normal: 1.0,
  slow: 0.5,
  ultraSlow: 0.25,
} as const;

// ── スコア(原仕様 §23)────────────────────────────────────
export const SCORE_BASE = 1000;
export const TIME_PENALTY_PER_SECOND = 5;
export const OBJECT_PENALTY_PER_OBJECT = 20;
export const RESET_PENALTY_PER_RESET = 30;

/**
 * ランクしきい値の既定値(原仕様 §24)。
 *
 * ステージ JSON の `score` が正本で、これはその既定値(SPEC D-03)。
 * §24 の帯(900–1000 GOLD / 700–899 SILVER / 400–699 BRONZE / 0–399 CLEAR)と
 * 一致させてあるので、既定のままなら両者は同じことを言う。
 */
export const RANK_THRESHOLDS = {
  gold: 900,
  silver: 700,
  bronze: 400,
} as const;

// ── 検証の範囲(原仕様 §55)────────────────────────────────
export const VALIDATION_RANGES = {
  friction: { min: 0, max: 1 },
  restitution: { min: 0, max: 1 },
  gravity: { min: 0, max: 5 },
} as const;

// ── 性能の上限目安(原仕様 §47 / SPEC N-02)─────────────────
export const MAX_BODIES_PER_STAGE = 100;
export const MAX_CONSTRAINTS_PER_STAGE = 30;

// ── 保存(原仕様 §37 / SPEC N-04)──────────────────────────
export const STORAGE_KEY = "physicsPuzzleLab.v1";
