import { CANVAS_HEIGHT, CANVAS_WIDTH, TICKS_PER_SECOND, WORLD_DEFAULTS } from "./constants";
import { LAB_PRESETS, TOOL_DEFAULTS } from "@/physics/presets";
import type { BodyState, WorldParams } from "@/types/physics";
import type { Stage } from "@/types/stage";
import type { Simulation } from "@/physics/world";

/**
 * Lab Mode。原仕様 §30〜§35。
 *
 * ここが持つのは**画面に出す量とその範囲**であって、物理ではない。
 * 物理は `Simulation` が持つ —— Lab もゲームも解答可能性検査も、
 * 同じ一つの経路を通る(原仕様 §80)。
 */

/**
 * Lab のパラメータ。
 *
 * 原仕様 §32 の 10 項目のうち、Ball Mass / Board Angle / Fan Force /
 * Spring Strength は世界ではなく**物体**の量なので、`WorldParams` とは別に持つ。
 */
export interface LabParams extends WorldParams {
  /** ボールの密度倍率。1 で既定。 */
  ballMass: number;
  /** 実験台の板の角度(ラジアン)。 */
  boardAngle: number;
  fanForce: number;
  springStrength: number;
}

export function defaultLabParams(): LabParams {
  return {
    ...WORLD_DEFAULTS,
    ballMass: 1,
    boardAngle: 0.15,
    fanForce: 0,
    springStrength: 0,
  };
}

/** スライダー 1 本ぶんの定義。原仕様 §31 / §32。 */
export interface LabSlider {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  /** 表示用の単位・注記。 */
  note?: string;
  get(p: LabParams): number;
  set(p: LabParams, v: number): LabParams;
}

/**
 * スライダーの一覧。
 *
 * **範囲は検証器(game/validation.ts)が許す範囲の内側に取る。** 画面で作れる値が
 * 検証を通らないなら、利用者はスライダーを端まで動かすだけで壊れた世界を作れてしまう。
 */
export const LAB_SLIDERS: LabSlider[] = [
  {
    key: "gravity",
    label: "Gravity",
    min: 0,
    max: 3,
    step: 0.005,
    note: "地球を 1.0 とした相対値(SI ではない)",
    get: (p) => p.gravityY,
    set: (p, v) => ({ ...p, gravityY: v }),
  },
  {
    key: "gravityDirection",
    label: "Gravity Direction",
    min: -2,
    max: 2,
    step: 0.01,
    note: "横向きの重力成分。左が負、右が正",
    get: (p) => p.gravityX,
    set: (p, v) => ({ ...p, gravityX: v }),
  },
  {
    key: "friction",
    label: "Friction",
    min: 0,
    max: 1,
    step: 0.005,
    get: (p) => p.friction,
    set: (p, v) => ({ ...p, friction: v }),
  },
  {
    key: "airResistance",
    label: "Air Resistance",
    min: 0,
    max: 0.2,
    step: 0.001,
    get: (p) => p.frictionAir,
    set: (p, v) => ({ ...p, frictionAir: v }),
  },
  {
    key: "restitution",
    label: "Restitution",
    min: 0,
    max: 1,
    step: 0.005,
    get: (p) => p.restitution,
    set: (p, v) => ({ ...p, restitution: v }),
  },
  {
    key: "ballMass",
    label: "Ball Mass",
    min: 0.2,
    max: 5,
    step: 0.05,
    note: "既定の密度に対する倍率",
    get: (p) => p.ballMass,
    set: (p, v) => ({ ...p, ballMass: v }),
  },
  {
    key: "boardAngle",
    label: "Board Angle",
    min: -0.8,
    max: 0.8,
    step: 0.01,
    note: "正で右下がり",
    get: (p) => p.boardAngle,
    set: (p, v) => ({ ...p, boardAngle: v }),
  },
  {
    key: "fanForce",
    label: "Fan Force",
    min: 0,
    max: 0.006,
    step: 0.0001,
    get: (p) => p.fanForce,
    set: (p, v) => ({ ...p, fanForce: v }),
  },
  {
    key: "springStrength",
    label: "Spring Strength",
    min: 0,
    max: 0.3,
    step: 0.005,
    get: (p) => p.springStrength,
    set: (p, v) => ({ ...p, springStrength: v }),
  },
  {
    key: "timeScale",
    label: "Time Scale",
    min: 0.25,
    max: 1,
    step: 0.25,
    note: "見せる速さ。物理の刻みは変えない(SPEC D-07)",
    get: (p) => p.timeScale,
    set: (p, v) => ({ ...p, timeScale: v }),
  },
];

/**
 * プリセットを当てる。原仕様 §33。
 *
 * **触れていない項目は書き換えない。** 重力だけを変えるつもりが摩擦まで
 * 戻ってしまうと、利用者は「何を変えたか」を追えなくなる。
 * 知らない名前は既定へ落とす(例外にしない)。
 */
export function applyLabPreset(params: LabParams, key: string): LabParams {
  const preset = LAB_PRESETS[key];
  if (!preset) return params;

  const { label: _label, ...changes } = preset;
  return { ...params, ...changes };
}

/**
 * Lab の実験台。
 *
 * ゴールは置くが、Lab は「クリアする場所」ではないので画面の隅へ寄せる。
 * 板は `boardAngle` で傾き、送風とばねは強さが 0 より大きいときだけ効く。
 */
export function buildLabStage(p: LabParams): Stage {
  const objects: Stage["fixedObjects"] = [
    {
      id: "bench",
      kind: "board",
      x: 430,
      y: 380,
      width: 420,
      height: 20,
      angle: p.boardAngle,
      isStatic: true,
    },
    {
      id: "floor",
      kind: "board",
      x: CANVAS_WIDTH / 2,
      y: 500,
      width: CANVAS_WIDTH,
      height: 20,
      angle: 0,
      isStatic: true,
    },
  ];

  if (p.fanForce > 0) {
    objects.push({
      id: "fan",
      kind: "fan",
      x: 140,
      y: 300,
      direction: 0,
      power: p.fanForce,
      range: TOOL_DEFAULTS.fan.range,
    });
  }

  if (p.springStrength > 0) {
    objects.push({
      id: "spring",
      kind: "spring",
      anchorX: 300,
      anchorY: 90,
      objectId: "ball",
      length: 140,
      stiffness: p.springStrength,
      damping: 0.02,
    });
  }

  return {
    id: 0,
    name: "Physics Lab",
    difficulty: 1,
    theme: "実験",
    hint: "値を動かして、起きることを見る。",
    world: { gravityX: p.gravityX, gravityY: p.gravityY },
    ball: {
      x: 300,
      y: 120,
      radius: 16,
      density: 0.001 * p.ballMass,
      friction: p.friction,
      restitution: p.restitution,
    },
    goal: { x: CANVAS_WIDTH - 90, y: CANVAS_HEIGHT - 130, width: 80, height: 80 },
    fixedObjects: objects,
    tools: { board: 0, block: 0, spring: 0, fan: 0 },
    timeLimit: 600,
    score: { gold: 900, silver: 700, bronze: 400 },
    solution: [],
  };
}

/** 画面に出す 1 項目。 */
export interface Readout {
  key: string;
  label: string;
  value: number;
  digits: number;
  unit?: string;
}

/**
 * 実時間の状態量。原仕様 §34。
 *
 * **値は物理の状態からそのまま取る。** 画面側で計算し直すと、
 * 物理と表示がずれても誰も気づかない(HC-045)。
 */
export function labReadouts(sim: Simulation): Readout[] {
  const s = sim.ballState();

  return [
    { key: "positionX", label: "Position X", value: s.x, digits: 1, unit: "px" },
    { key: "positionY", label: "Position Y", value: s.y, digits: 1, unit: "px" },
    { key: "velocityX", label: "Velocity X", value: s.vx, digits: 3, unit: "px/tick" },
    { key: "velocityY", label: "Velocity Y", value: s.vy, digits: 3, unit: "px/tick" },
    { key: "speed", label: "Speed", value: s.speed, digits: 3, unit: "px/tick" },
    { key: "angularVelocity", label: "Angular Velocity", value: s.angularVelocity, digits: 4, unit: "rad/tick" },
    { key: "collisionCount", label: "Collision Count", value: sim.collisionCount, digits: 0 },
    { key: "elapsedTime", label: "Elapsed Time", value: sim.tick / TICKS_PER_SECOND, digits: 2, unit: "秒" },
  ];
}

export interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 速度ベクトルの見かけの長さの上限(px)。画面からはみ出させない。 */
const MAX_ARROW = 160;
const ARROW_SCALE = 14;

/**
 * 速度ベクトル。原仕様 §35。
 *
 * **止まっているときは矢印を出さない。** 長さ 0 の矢印は「向きが無い」のではなく
 * 「向きが不定」であり、描くと直前の向きが残って嘘をつく。
 */
export function velocityArrow(s: BodyState): Arrow | null {
  if (s.speed <= 0) return null;

  const length = Math.min(MAX_ARROW, s.speed * ARROW_SCALE);
  const ux = s.vx / s.speed;
  const uy = s.vy / s.speed;

  return { x1: s.x, y1: s.y, x2: s.x + ux * length, y2: s.y + uy * length };
}
