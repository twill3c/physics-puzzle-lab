import Matter from "matter-js";

import { CANVAS_HEIGHT, CANVAS_WIDTH, GOAL_DWELL_TICKS, TICKS_PER_SECOND } from "@/lib/constants";
import type { Stage } from "@/types/stage";
import type {
  BodyState,
  FanDefinition,
  Placement,
  PhysicsObjectDefinition,
  WorldParams,
} from "@/types/physics";
import type { ClearResult } from "@/types/game";

import { createEngine, gravityPerTick2, resolveWorldParams, stepEngine } from "./engine";
import { createBall, createBlock, createBoard, createBounds, createGoal } from "./bodies";
import { createLink, createSpring } from "./constraints";
import { applyFanForces } from "./forces";
import { applyMovers, createMoverBase, type MoverBase } from "./movers";
import { countCollisionStarts, hasFallenOut, isTouchingGoal } from "./sensors";
import { placementToDefinition } from "./presets";

export interface SimulationOptions {
  stage: Stage;
  /** プレイヤーが置いた部品。省略時は「何も置いていない」状態。 */
  placements?: Placement[];
  /** 世界パラメータの上書き。Lab Mode と物理検査で使う。 */
  world?: Partial<WorldParams>;
}

/** 1 tick 分の観測。決定論の照合に使う。 */
export interface SimSnapshot {
  tick: number;
  ball: BodyState;
}

/**
 * ステージ 1 面ぶんのシミュレーション。
 *
 * **ゲームも Lab も解答可能性検査(G-01)も、すべてこの一つの経路を通る。**
 * 検査専用の別実装を置かないのは、ずれたときに誰も気づかないからである(HC-065)。
 *
 * 決定論の条件(SPEC D-01):
 * - delta は常に `TICK_MS`。実時間を参照しない
 * - Body の生成順を固定する(外枠 → 固定物 → 配置 → ボール → ゴール)
 * - `Matter.Runner` を使わない
 */
export class Simulation {
  readonly engine: Matter.Engine;
  readonly ball: Matter.Body;
  readonly goal: Matter.Body;
  readonly params: WorldParams;

  private readonly stage: Stage;
  private readonly bodiesById = new Map<string, Matter.Body>();
  private readonly fans: FanDefinition[] = [];
  private readonly movers: MoverBase[] = [];

  private _tick = 0;
  private _collisionCount = 0;
  private _goalDwellTicks = 0;
  private _status: ClearResult["status"] = "RUNNING";

  constructor(opts: SimulationOptions) {
    this.stage = opts.stage;
    this.params = resolveWorldParams({
      gravityX: opts.stage.world.gravityX,
      gravityY: opts.stage.world.gravityY,
      ...opts.world,
    });

    this.engine = createEngine(this.params);

    // ── 生成順を固定する。順が変わると決定論が崩れる ──────────────
    const bodies: Matter.Body[] = [];

    // 1. 外枠
    bodies.push(...createBounds(CANVAS_WIDTH, CANVAS_HEIGHT, this.params));

    // 2. ステージの固定物
    for (const def of opts.stage.fixedObjects) {
      this.addDefinition(def, bodies);
    }

    // 3. プレイヤーの配置
    for (const p of opts.placements ?? []) {
      this.addDefinition(placementToDefinition(p), bodies);
    }

    // 4. ボール
    this.ball = createBall(opts.stage.ball, this.params);
    this.bodiesById.set("ball", this.ball);
    bodies.push(this.ball);

    // 5. 追加のボール(原仕様 §22 Stage 17)。id は ball-2 から順に振る
    (opts.stage.extraBalls ?? []).forEach((def, i) => {
      const body = createBall(def, this.params);
      this.bodiesById.set(`ball-${i + 2}`, body);
      bodies.push(body);
    });

    // 6. ゴール(センサー)
    this.goal = createGoal(opts.stage.goal);
    this.bodiesById.set("goal", this.goal);
    bodies.push(this.goal);

    Matter.Composite.add(this.engine.world, bodies);

    // 7. 拘束は相手の Body が揃ってから繋ぐ
    const allDefs = [
      ...opts.stage.fixedObjects,
      ...(opts.placements ?? []).map(placementToDefinition),
    ];

    for (const def of allDefs) {
      if (def.kind === "spring") {
        Matter.Composite.add(this.engine.world, createSpring(def, (id) => this.bodiesById.get(id)));
      } else if (def.kind === "link") {
        Matter.Composite.add(this.engine.world, createLink(def, (id) => this.bodiesById.get(id)));
      }
    }

    // 8. 規定運動も対象の Body が揃ってから登録する
    for (const def of allDefs) {
      if (def.kind !== "mover") continue;

      const target = this.bodiesById.get(def.target);
      if (!target) {
        throw new Error(
          `mover "${def.id}" の対象 "${def.target}" が見つからない。` +
            `ステージ検証を通っていれば起きえない(physics/world.ts)`,
        );
      }
      this.movers.push(createMoverBase(def, target));
    }
  }

  /** 定義 1 件を Body へ変えて登録する(ばねと送風は Body を作らない)。 */
  private addDefinition(def: PhysicsObjectDefinition, sink: Matter.Body[]): void {
    switch (def.kind) {
      case "board": {
        const body = createBoard(def, this.params);
        this.bodiesById.set(def.id, body);
        sink.push(body);
        break;
      }
      case "block": {
        const body = createBlock(def);
        this.bodiesById.set(def.id, body);
        sink.push(body);
        break;
      }
      case "fan":
        this.fans.push(def);
        break;
      case "spring":
      case "link":
      case "mover":
        // 相手・対象の Body が揃ってから繋ぐので、ここでは何もしない。
        break;
    }
  }

  get tick(): number {
    return this._tick;
  }

  get collisionCount(): number {
    return this._collisionCount;
  }

  get goalDwellTicks(): number {
    return this._goalDwellTicks;
  }

  get status(): ClearResult["status"] {
    return this._status;
  }

  /** 1 tick 進める。 */
  step(): void {
    if (this._status !== "RUNNING") return;

    // 規定運動は積分の前に置き直す。そうしないと、ボールは
    // 「1 tick 前の台の位置」に対して解かれてしまう。
    // 渡すのはこれから進める tick 番号(1 始まり)。
    applyMovers(this.movers, this._tick + 1);

    // 送風は積分の前に加える。matter-js は update のたびに force を消すので、
    // 毎 tick 加え直す必要がある(原仕様 §52)。
    applyFanForces(this.fans, Matter.Composite.allBodies(this.engine.world));

    stepEngine(this.engine);
    this._tick += 1;
    this._collisionCount += countCollisionStarts(this.engine);

    // ゴール滞在。連続していることを要求する ——
    // 出入りを繰り返して合計 18 tick でもクリアにはしない(原仕様 §16)。
    if (isTouchingGoal(this.engine, this.ball, this.goal)) {
      this._goalDwellTicks += 1;
    } else {
      this._goalDwellTicks = 0;
    }

    if (this._goalDwellTicks >= GOAL_DWELL_TICKS) {
      this._status = "CLEAR";
      return;
    }

    if (hasFallenOut(this.ball, CANVAS_HEIGHT)) {
      this._status = "FAILED";
    }
  }

  /** n tick 進める。 */
  runTicks(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }

  /**
   * 決着がつくまで進める。解答可能性検査(G-01)の本体。
   *
   * 制限時間(秒)を tick に直して上限とする。上限に達したら FAILED を返す ——
   * 「時間切れ」と「まだ動いている」を区別しない。配れるかどうかだけが要るからである。
   */
  runUntilSettled(maxTicksOverride?: number): ClearResult {
    const maxTicks = maxTicksOverride ?? Math.ceil(this.stage.timeLimit * TICKS_PER_SECOND);

    while (this._status === "RUNNING" && this._tick < maxTicks) {
      this.step();
    }

    if (this._status === "RUNNING") this._status = "FAILED";

    return {
      status: this._status,
      elapsedTicks: this._tick,
      goalDwellTicks: this._goalDwellTicks,
    };
  }

  /** 0 tick 目を含む n+1 件の観測列を返す。 */
  trajectory(n: number): SimSnapshot[] {
    const out: SimSnapshot[] = [this.snapshot()];

    for (let i = 0; i < n; i++) {
      this.step();
      out.push(this.snapshot());
    }

    return out;
  }

  snapshot(): SimSnapshot {
    return { tick: this._tick, ball: this.ballState() };
  }

  ballState(): BodyState {
    return toBodyState(this.ball);
  }

  /** ステージ定義の id で物体の状態を取る。 */
  objectState(id: string): BodyState {
    const body = this.bodiesById.get(id);
    if (!body) throw new Error(`物体 "${id}" は世界に存在しない`);
    return toBodyState(body);
  }

  /**
   * ボールの力学的エネルギー(SPEC O-4)。
   *
   * 単位は tick を時間の単位に取った内部単位である —— `body.velocity` が
   * 「1 tick あたりの変位」だからで、SI ではない。
   *
   *   E = ½ m v² + m a (y_ref − y)
   *
   * `a` は `gravityPerTick2` で導く実効加速度、`y_ref` はキャンバス下端。
   * Canvas 座標は下向きが正なので、高いほど (y_ref − y) が大きい。
   */
  mechanicalEnergy(): number {
    const m = this.ball.mass;
    const v = this.ball.velocity;
    const a = gravityPerTick2(this.params.gravityY);

    const kinetic = 0.5 * m * (v.x * v.x + v.y * v.y);
    const potential = m * a * (CANVAS_HEIGHT - this.ball.position.y);

    return kinetic + potential;
  }
}

function toBodyState(body: Matter.Body): BodyState {
  return {
    x: body.position.x,
    y: body.position.y,
    vx: body.velocity.x,
    vy: body.velocity.y,
    speed: Math.hypot(body.velocity.x, body.velocity.y),
    angle: body.angle,
    angularVelocity: body.angularVelocity,
  };
}
