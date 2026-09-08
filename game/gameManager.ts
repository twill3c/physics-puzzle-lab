import { TICKS_PER_SECOND, TIME_SCALES } from "@/lib/constants";
import type { BodyState, Placement, ToolKind } from "@/types/physics";
import type { GameStatus, ScoreBreakdown } from "@/types/game";
import type { Stage } from "@/types/stage";
import { Simulation } from "@/physics/world";

import { computeScore } from "./scoreManager";
import { canPlace, createToolState, place as placeTool, remove as removeTool, type ToolState } from "./toolManager";
import { createRecorder, type Recorder } from "./replayManager";

/**
 * ゲーム 1 面ぶんの進行。原仕様 §36(UI 状態)/ §23(スコア)/ §28 / §29。
 *
 * ここが持つのは**状態と時間**であって、物理ではない。物理は `Simulation` が持つ。
 * 分けておくと、Lab Mode や解答可能性検査(G-01)が同じ物理をそのまま使える
 * (原仕様 §80「Physics Engine と Game Logic を分離する」)。
 *
 * `Simulation` は START のたびに作り直す。途中から状態を巻き戻すのではなく
 * 初期状態から組み直すので、リセットしても決定論が保たれる(SPEC D-01)。
 */
export interface Game {
  readonly stage: Stage;
  readonly status: GameStatus;
  readonly placements: Placement[];
  readonly resetCount: number;
  readonly elapsedTicks: number;
  readonly score: ScoreBreakdown | null;

  canPlace(kind: ToolKind): boolean;
  place(id: string, kind: ToolKind, x: number, y: number, angle?: number): void;
  move(id: string, x: number, y: number): void;
  rotate(id: string, angle: number): void;
  remove(id: string): void;

  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;

  /** n tick 進める。停止中は進まない。 */
  advance(ticks: number): void;
  /** 決着まで進める。 */
  runToEnd(): void;

  setTimeScale(scale: number): void;
  /**
   * 経過フレーム数に対して、いま進めるべき tick 数。
   *
   * **物理の刻みは変えない**(SPEC D-07)。Slow Motion は
   * 「1 フレームで進める tick 数」を減らして表現する。
   */
  ticksForFrame(frames: number): number;

  ballState(): BodyState;
  simulation(): Simulation | null;
  replay(): ReturnType<Recorder["build"]>;
}

export function createGame(stage: Stage): Game {
  let status: GameStatus = "READY";
  let tools: ToolState = createToolState(stage);
  const placements = new Map<string, Placement>();
  const order: string[] = [];

  let sim: Simulation | null = null;
  let resetCount = 0;
  let elapsedTicks = 0;
  let score: ScoreBreakdown | null = null;
  // TIME_SCALES は `as const` なので、注釈が無いとリテラル型 1 に推論されて
  // setTimeScale で代入できなくなる。
  let timeScale: number = TIME_SCALES.normal;
  let frameAccumulator = 0;

  const recorder = createRecorder(stage.id);

  const list = (): Placement[] => order.filter((id) => placements.has(id)).map((id) => placements.get(id)!);

  const requireEditable = (what: string) => {
    if (status === "RUNNING" || status === "PAUSED") {
      throw new Error(`実行中は${what}できない。先に Reset するか、決着を待つこと`);
    }
  };

  const finish = (next: Extract<GameStatus, "CLEAR" | "FAILED">) => {
    status = next;
    if (next === "CLEAR") {
      score = computeScore(
        {
          elapsedSeconds: elapsedTicks / TICKS_PER_SECOND,
          usedObjects: placements.size,
          resetCount,
        },
        stage.score,
      );
    }
  };

  const game: Game = {
    stage,
    get status() {
      return status;
    },
    get placements() {
      return list();
    },
    get resetCount() {
      return resetCount;
    },
    get elapsedTicks() {
      return elapsedTicks;
    },
    get score() {
      return score;
    },

    canPlace: (kind) => canPlace(tools, kind),

    place(id, kind, x, y, angle = 0) {
      requireEditable("配置");
      tools = placeTool(tools, kind, id);
      if (!placements.has(id)) order.push(id);
      placements.set(id, { id, kind, x, y, angle });
      recorder.create(id, kind, x, y, angle);
      status = "EDITING";
    },

    move(id, x, y) {
      requireEditable("移動");
      const p = placements.get(id);
      if (!p) throw new Error(`配置 "${id}" は存在しない`);
      placements.set(id, { ...p, x, y });
      recorder.move(id, x, y);
    },

    rotate(id, angle) {
      requireEditable("回転");
      const p = placements.get(id);
      if (!p) throw new Error(`配置 "${id}" は存在しない`);
      placements.set(id, { ...p, angle });
      recorder.rotate(id, angle);
    },

    remove(id) {
      requireEditable("削除");
      if (!placements.has(id)) return;
      placements.delete(id);
      tools = removeTool(tools, id);
      recorder.delete(id);
    },

    start() {
      if (status === "RUNNING") return;
      // 途中から再開するのではなく、常に初期状態から組み直す。
      sim = new Simulation({ stage, placements: list() });
      elapsedTicks = 0;
      score = null;
      frameAccumulator = 0;
      status = "RUNNING";
      recorder.start();
    },

    pause() {
      if (status === "RUNNING") status = "PAUSED";
    },

    resume() {
      if (status === "PAUSED") status = "RUNNING";
    },

    reset() {
      // 置いた部品は残す —— 消すと「やり直し」ではなく「作り直し」になる。
      sim = null;
      elapsedTicks = 0;
      score = null;
      frameAccumulator = 0;
      resetCount += 1;
      status = placements.size > 0 ? "EDITING" : "READY";
      recorder.reset();
    },

    advance(ticks) {
      if (status !== "RUNNING" || !sim) return;

      for (let i = 0; i < ticks; i++) {
        sim.step();
        elapsedTicks += 1;

        if (sim.status === "CLEAR") return finish("CLEAR");
        if (sim.status === "FAILED") return finish("FAILED");

        if (elapsedTicks >= stage.timeLimit * TICKS_PER_SECOND) return finish("FAILED");
      }
    },

    runToEnd() {
      const limit = stage.timeLimit * TICKS_PER_SECOND;
      while (status === "RUNNING" && elapsedTicks < limit) {
        game.advance(1);
      }
      if (status === "RUNNING") finish("FAILED");
    },

    setTimeScale(scale) {
      timeScale = scale;
      frameAccumulator = 0;
    },

    ticksForFrame(frames) {
      frameAccumulator += frames * timeScale;
      const whole = Math.floor(frameAccumulator);
      frameAccumulator -= whole;
      return whole;
    },

    ballState() {
      if (!sim) throw new Error("まだ開始していない");
      return sim.ballState();
    },

    simulation: () => sim,
    replay: () => recorder.build(),
  };

  return game;
}
