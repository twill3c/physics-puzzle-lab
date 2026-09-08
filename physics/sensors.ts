import Matter from "matter-js";

/**
 * ゴール検出と落下検出。原仕様 §15 / §16 / §53。
 *
 * ゴールは `isSensor = true` の Body なので、跳ね返らずに衝突だけが検出される。
 * matter-js は活性な衝突対を `engine.pairs.collisionActive` に毎 tick 並べ直すので、
 * そこを読めば「いま重なっているか」が分かる(matter-js 0.20 の実物で確認、2026-09-08)。
 *
 * **滞在は時間ではなく tick で数える**(SPEC D-05)。300 ms は 60 Hz 固定なら 18 tick で、
 * 固定ステップなので判定が決定論になる。
 */

/** いま ball と goal が重なっているか。 */
export function isTouchingGoal(engine: Matter.Engine, ball: Matter.Body, goal: Matter.Body): boolean {
  const pairs = engine.pairs.collisionActive;

  for (const pair of pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;
    if ((a === ball && b === goal) || (a === goal && b === ball)) return true;
  }

  return false;
}

/**
 * 実体のある衝突(センサーを除く)の開始回数。
 *
 * 決定論の経路照合(HC-065)と、エネルギー検査の前提固定(接触 0 件)に使う。
 * センサーを数えないのは、ゴール通過を「衝突」として数えると
 * 「接触していない自由飛行」の定義が壊れるからである。
 */
export function countCollisionStarts(engine: Matter.Engine): number {
  const started = engine.pairs.collisionStart;
  let n = 0;

  for (const pair of started) {
    if (pair.isSensor) continue;
    n += 1;
  }

  return n;
}

/**
 * 世界の外へ落ちたか。原仕様の RETRY 条件「落下」。
 *
 * 床は閉じていない(physics/bodies.ts の createBounds)ので、
 * キャンバス下端を十分に越えたら失敗とする。半径ぶんの余裕を取って、
 * 下端に触れただけでは失敗にしない。
 */
export function hasFallenOut(ball: Matter.Body, canvasHeight: number): boolean {
  return ball.position.y - ball.circleRadius! > canvasHeight;
}
