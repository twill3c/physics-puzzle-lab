import Matter from "matter-js";

import { BALL_DEFAULTS } from "@/lib/constants";
import type {
  BallDefinition,
  BlockDefinition,
  BoardDefinition,
  GoalDefinition,
  WorldParams,
} from "@/types/physics";

/**
 * 定義 → Matter.Body の生成。
 *
 * 生成順は決定論に効く(matter-js は挿入順に走査する)ので、
 * 呼ぶ側は必ず同じ順で呼ぶこと。ここでは順を作らない。
 *
 * `label` にはステージ定義の id をそのまま入れる。衝突判定と
 * 状態の取り出しをこの id で行うため、**id の一意性は検証層が保証する**。
 */

/** ボール。原仕様 §10 / §49。 */
export function createBall(def: BallDefinition, world: WorldParams): Matter.Body {
  return Matter.Bodies.circle(def.x, def.y, def.radius, {
    label: "ball",
    density: def.density ?? BALL_DEFAULTS.density,
    friction: def.friction ?? BALL_DEFAULTS.friction,
    restitution: def.restitution ?? BALL_DEFAULTS.restitution,
    frictionAir: world.frictionAir,
  });
}

/** 板。原仕様 §11 / §50。 */
export function createBoard(def: BoardDefinition, world: WorldParams): Matter.Body {
  return Matter.Bodies.rectangle(def.x, def.y, def.width, def.height, {
    label: def.id,
    isStatic: def.isStatic,
    angle: def.angle,
    friction: world.friction,
    restitution: world.restitution,
  });
}

/** 箱。原仕様 §12。 */
export function createBlock(def: BlockDefinition): Matter.Body {
  return Matter.Bodies.rectangle(def.x, def.y, def.width, def.height, {
    label: def.id,
    isStatic: def.isStatic ?? false,
    angle: def.angle ?? 0,
    density: def.density,
    friction: def.friction,
    restitution: def.restitution,
  });
}

/**
 * ゴール。原仕様 §15 / §51。
 *
 * `isSensor = true` なので衝突は検出されるが跳ね返らない。
 * ボールがゴールを「通り抜けながら」滞在時間を数えることになる(原仕様 §16)。
 */
export function createGoal(def: GoalDefinition): Matter.Body {
  return Matter.Bodies.rectangle(def.x, def.y, def.width, def.height, {
    label: "goal",
    isStatic: true,
    isSensor: true,
  });
}

/**
 * 世界の外枠(床・天井・左右の壁)。
 *
 * 原仕様 §4.1 が「地面」「壁」を必須機能に挙げている。
 * 外枠が無いとボールが世界の外へ出て、失敗判定と区別がつかなくなる。
 *
 * 床だけは**外枠より下**に落下判定の余地を残したいので、
 * 落下による FAILED は床ではなくキャンバス下端を越えたかで判定する
 * (physics/sensors.ts)。ここでは左右と天井のみを閉じ、床は開けておく。
 */
export function createBounds(width: number, height: number, world: WorldParams): Matter.Body[] {
  const t = 60; // 壁の厚み。薄いとすり抜けるので十分に取る
  const opts = {
    isStatic: true,
    friction: world.friction,
    restitution: world.restitution,
  };

  return [
    // 左
    Matter.Bodies.rectangle(-t / 2, height / 2, t, height * 3, { ...opts, label: "wall-left" }),
    // 右
    Matter.Bodies.rectangle(width + t / 2, height / 2, t, height * 3, {
      ...opts,
      label: "wall-right",
    }),
    // 天井
    Matter.Bodies.rectangle(width / 2, -t / 2, width, t, { ...opts, label: "wall-top" }),
  ];
}
