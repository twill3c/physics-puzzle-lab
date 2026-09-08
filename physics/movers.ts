import Matter from "matter-js";

import type { MoverDefinition } from "@/types/physics";

/**
 * 規定運動。原仕様 §22 の Stage 13 / 15 / 18。
 *
 * **位置と角度を tick の純関数として与える。**
 *
 *   oscillateX / oscillateY : base + A·sin(2π(t/P + φ))
 *   rotate                  : baseAngle + 2π(t/P + φ)
 *
 * 力を加えるのではなく毎 tick「その時刻にあるべき場所」へ置き直すので、
 * 状態が積み上がらない。何度走らせても同じ運動になり、決定論(SPEC D-01)を壊さない。
 *
 * `updateVelocity` は **true** で置き直す。matter-js の `Body.setPosition` は
 * 第 3 引数が true のとき差分を `velocity` に入れるので、衝突解決のときに
 * その速度が相手へ伝わる —— **これが無いと台だけが動いてボールが取り残され、
 * エレベータにならない**(実物で確認、2026-09-08)。
 */

/**
 * `updateVelocity`(第 3 引数)つきの型。
 *
 * `@types/matter-js` 0.20.2 は `setPosition(body, position)` / `setAngle(body, angle)` の
 * **2 引数でしか宣言していない**が、matter-js 0.20.0 の実体は第 3 引数 `updateVelocity` を
 * 受け取る(`src/body/Body.js` を読んで確認、2026-09-08)。型定義が実体に追いついていない。
 *
 * **この差は型検査でしか出ない。** vitest は型を見ないので、テストは全件緑のまま
 * `tsc` だけが落ちる(HC-062)。逆に、将来 matter-js が第 3 引数を落としたら
 * 型は通るのに台がボールを運ばなくなる —— **そちらは T-033(台に載ったボールが
 * 持ち上がる)が捕まえる。** 型と挙動の両側に見張りを置いてある。
 */
type SetPositionWithVelocity = (
  body: Matter.Body,
  position: Matter.Vector,
  updateVelocity?: boolean,
) => void;

type SetAngleWithVelocity = (body: Matter.Body, angle: number, updateVelocity?: boolean) => void;

const setPosition = Matter.Body.setPosition as unknown as SetPositionWithVelocity;
const setAngle = Matter.Body.setAngle as unknown as SetAngleWithVelocity;

/** 動かす対象の基準位置・基準角度。世界を組んだ時点の値を控えておく。 */
export interface MoverBase {
  def: MoverDefinition;
  body: Matter.Body;
  baseX: number;
  baseY: number;
  baseAngle: number;
}

export function createMoverBase(def: MoverDefinition, body: Matter.Body): MoverBase {
  return {
    def,
    body,
    baseX: body.position.x,
    baseY: body.position.y,
    baseAngle: body.angle,
  };
}

/**
 * tick 時点のあるべき状態へ置き直す。
 *
 * `tick` は「これから進める tick 番号」を渡す(1 始まり)。
 */
export function applyMovers(movers: MoverBase[], tick: number): void {
  for (const m of movers) {
    const { def, body } = m;
    const phase = def.phase ?? 0;

    // periodTicks が 0 以下だと 0 除算になる。検証層で弾いているが、
    // ここでも黙って NaN を作らないように無視する。
    if (!(def.periodTicks > 0)) continue;

    const turns = tick / def.periodTicks + phase;

    switch (def.motion) {
      case "oscillateX": {
        const a = def.amplitude ?? 0;
        const x = m.baseX + a * Math.sin(2 * Math.PI * turns);
        setPosition(body, { x, y: body.position.y }, true);
        break;
      }
      case "oscillateY": {
        const a = def.amplitude ?? 0;
        const y = m.baseY + a * Math.sin(2 * Math.PI * turns);
        setPosition(body, { x: body.position.x, y }, true);
        break;
      }
      case "rotate": {
        setAngle(body, m.baseAngle + 2 * Math.PI * turns, true);
        break;
      }
    }
  }
}
