import Matter from "matter-js";

import type { FanDefinition } from "@/types/physics";

/**
 * 送風。原仕様 §14 / §52。
 *
 * 毎 tick、範囲内の**動体**へ力を加える。原仕様の計算イメージ:
 *   forceX = cos(direction) × power
 *   forceY = sin(direction) × power
 *
 * `direction` はラジアン。Canvas 座標系なので y は下向きが正である
 * (direction = π/2 は「下向き」を意味する)。
 *
 * 範囲は送風源からの距離で判定する円形の影響圏。距離が `range` 以内なら
 * 力は一定で、減衰させない —— 減衰の形は原仕様が定めておらず、
 * 勝手に決めるとステージの解が実装の都合で変わる。
 */
export function applyFanForces(fans: FanDefinition[], bodies: Matter.Body[]): void {
  if (fans.length === 0) return;

  for (const fan of fans) {
    const fx = Math.cos(fan.direction) * fan.power;
    const fy = Math.sin(fan.direction) * fan.power;
    const rangeSq = fan.range * fan.range;

    for (const body of bodies) {
      if (body.isStatic || body.isSensor) continue;

      const dx = body.position.x - fan.x;
      const dy = body.position.y - fan.y;
      if (dx * dx + dy * dy > rangeSq) continue;

      Matter.Body.applyForce(body, body.position, { x: fx, y: fy });
    }
  }
}
