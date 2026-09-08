/**
 * 物理オブジェクトの定義型。
 *
 * 出所: 原仕様 §10(Ball)/ §11(Board)/ §12(Block)/ §13(Spring)/ §14(Fan)/ §15(Goal)。
 * ここに書くのは「ステージ JSON に載る宣言的な形」であって、Matter.js の Body ではない。
 * 宣言 → 検証 → Body 生成の順に一方向で流す(SPEC D-06)。
 */

/** 部品の種別。Tool Palette の 4 種(原仕様 §19)に、ステージ側の固定物を加えたもの。 */
export type ObjectKind = "board" | "block" | "spring" | "fan";

/** Tool Palette が扱える部品の種別(原仕様 §19: BOARD / BLOCK / SPRING / FAN)。 */
export const TOOL_KINDS = ["board", "block", "spring", "fan"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

/** 原仕様 §10。推奨初期値は lib/constants.ts の BALL_DEFAULTS に置く。 */
export interface BallDefinition {
  x: number;
  y: number;
  radius: number;
  density?: number;
  friction?: number;
  restitution?: number;
}

/** 原仕様 §11。板・坂・橋に使う。`angle` はラジアン。 */
export interface BoardDefinition {
  id: string;
  kind: "board";
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  isStatic: boolean;
}

/** 原仕様 §12。 */
export interface BlockDefinition {
  id: string;
  kind: "block";
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  density: number;
  friction: number;
  restitution: number;
  isStatic?: boolean;
}

/**
 * 原仕様 §13。Matter.js Constraint で表現する。
 *
 * 原仕様の `objectId` は「ばねが繋がる相手」を指す。V1.0 ではボール、または
 * 同じステージ内の固定物 id を取る。未指定(null)のときは最寄りの動体へ繋ぐのではなく、
 * **繋がないで検証エラーにする** —— 黙って別の相手へ繋ぐと、同じ JSON が別の意味になる。
 */
export interface SpringDefinition {
  id: string;
  kind: "spring";
  anchorX: number;
  anchorY: number;
  objectId: string;
  length: number;
  stiffness: number;
  damping: number;
}

/**
 * 原仕様 §14。範囲内の物体へ一定の力を加える。
 *
 * `direction` はラジアン(x 軸正方向が 0、Canvas 座標系なので y は下向きが正)。
 * `range` は送風源からの距離のしきい値で、円形の影響圏として扱う。
 */
export interface FanDefinition {
  id: string;
  kind: "fan";
  x: number;
  y: number;
  direction: number;
  power: number;
  range: number;
}

/** 原仕様 §15。Matter.js Sensor(`isSensor = true`)として実装する。 */
export interface GoalDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 規定運動。原仕様 §22 の Stage 13(Elevator)/ 15(Rotating Platform)/ 18(Moving Goal)。
 *
 * **位置と角度を tick の純関数として与える。** 力を加えるのではなく、毎 tick
 * 「その時刻にあるべき場所」へ置き直す。状態を積み上げないので、途中から始めても、
 * 何度走らせても同じ運動になる —— 決定論(SPEC D-01)を壊さないための形である。
 *
 * 対象は `target` の id で指す。`"goal"` を指定するとゴールが動く。
 */
export interface MoverDefinition {
  id: string;
  kind: "mover";
  /** 動かす対象の id。`"goal"` でゴール。 */
  target: string;
  motion: "oscillateX" | "oscillateY" | "rotate";
  /** 振動の片振幅(px)。`rotate` では使わない。 */
  amplitude?: number;
  /** 1 周期にかかる tick 数。 */
  periodTicks: number;
  /** 位相(0〜1)。0 なら基準位置から始まる。 */
  phase?: number;
}

/**
 * 物体どうしを繋ぐ拘束。原仕様 §22 の Stage 14(Pulley 滑車・張力)。
 *
 * `spring` が「点と物体」を繋ぐのに対し、これは「物体と物体」を繋ぐ。
 * `stiffness` を 1 に近づけると綱、小さくするとばねとして振る舞う。
 */
export interface LinkDefinition {
  id: string;
  kind: "link";
  bodyA: string;
  bodyB: string;
  length: number;
  stiffness: number;
  damping?: number;
}

/** ステージ JSON の `fixedObjects` に載りうる定義の総和。 */
export type PhysicsObjectDefinition =
  | BoardDefinition
  | BlockDefinition
  | SpringDefinition
  | FanDefinition
  | MoverDefinition
  | LinkDefinition;

/**
 * プレイヤーが置いた部品 1 個(SPEC §8「配置」)。
 *
 * ステージ側の固定物と同じ定義型を使い、`fromTool` で出自を区別する。
 * スコアの ObjectPenalty(原仕様 §23)は `fromTool` が真のものだけを数える ——
 * ステージが最初から置いている物を減点したら、同じ盤面が別の点になる。
 */
export interface Placement {
  id: string;
  kind: ToolKind;
  x: number;
  y: number;
  angle: number;
  /** 種別ごとの追加パラメータ(板の寸法、送風の向きと強さ等)。 */
  params?: Record<string, number>;
}

/** 物理世界の大域パラメータ(原仕様 §17 標準世界 / §30–§32 Lab Mode)。 */
export interface WorldParams {
  gravityX: number;
  gravityY: number;
  friction: number;
  frictionAir: number;
  restitution: number;
  /** 原仕様 §28: 1.0 / 0.5 / 0.25。物理の刻みではなく 1 フレームで進める tick 数に効かせる。 */
  timeScale: number;
}

/** 物体の実時間の状態量(原仕様 §34)。 */
export interface BodyState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  angularVelocity: number;
}
