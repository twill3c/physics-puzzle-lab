import Matter from "matter-js";

import type { LinkDefinition, SpringDefinition } from "@/types/physics";

/**
 * ばね。原仕様 §13。Matter.js Constraint で表現する。
 *
 * `objectId` が指す相手が見つからないときは**繋がずに例外で止める**。
 * 黙って最寄りの動体へ繋ぐと、同じ JSON が別の意味になる —— 仮定が崩れたときに
 * 違う結果を出すのではなく、落ちて教える(HC-075)。
 */
export function createSpring(
  def: SpringDefinition,
  resolveBody: (id: string) => Matter.Body | undefined,
): Matter.Constraint {
  const body = resolveBody(def.objectId);

  if (!body) {
    throw new Error(
      `spring "${def.id}" の接続先 "${def.objectId}" が見つからない。` +
        `ステージ検証を通っていれば起きえない(physics/constraints.ts)`,
    );
  }

  return Matter.Constraint.create({
    label: def.id,
    pointA: { x: def.anchorX, y: def.anchorY },
    bodyB: body,
    length: def.length,
    stiffness: def.stiffness,
    damping: def.damping,
  });
}

/**
 * 物体どうしを繋ぐ拘束。原仕様 §22 の Stage 14(Pulley 滑車・張力)。
 *
 * `createSpring` と同じく、相手が見つからなければ**繋がずに例外で止める**。
 */
export function createLink(
  def: LinkDefinition,
  resolveBody: (id: string) => Matter.Body | undefined,
): Matter.Constraint {
  const a = resolveBody(def.bodyA);
  const b = resolveBody(def.bodyB);

  if (!a || !b) {
    const missing = !a ? def.bodyA : def.bodyB;
    throw new Error(
      `link "${def.id}" の接続先 "${missing}" が見つからない。` +
        `ステージ検証を通っていれば起きえない(physics/constraints.ts)`,
    );
  }

  return Matter.Constraint.create({
    label: def.id,
    bodyA: a,
    bodyB: b,
    length: def.length,
    stiffness: def.stiffness,
    damping: def.damping ?? 0,
  });
}
