import type { Stage } from "@/types/stage";
import type { PhysicsObjectDefinition, Placement } from "@/types/physics";
import { BALL_DEFAULTS, CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/constants";

/**
 * 物理検査用の合成ステージ。
 *
 * **出荷と同じ経路を通す**ためにこの型を使う(HC-065: 片方が出荷物で
 * もう片方がテスト専用だと、ずれても誰も気づかない)。ここが作るのは
 * 「入力」だけで、世界の組み立ては出荷コード(physics/world.ts)が行う。
 */
export function makeStage(overrides: Partial<Stage> = {}): Stage {
  const base: Stage = {
    id: 999,
    name: "テスト用",
    difficulty: 1,
    theme: "検査",
    hint: "物理検査のための合成ステージ",
    world: { gravityX: 0, gravityY: 1 },
    ball: {
      x: 100,
      y: 60,
      radius: BALL_DEFAULTS.radius,
      density: BALL_DEFAULTS.density,
      friction: BALL_DEFAULTS.friction,
      restitution: BALL_DEFAULTS.restitution,
    },
    goal: { x: CANVAS_WIDTH - 120, y: CANVAS_HEIGHT - 120, width: 60, height: 60 },
    fixedObjects: [],
    tools: { board: 0, block: 0, spring: 0, fan: 0 },
    timeLimit: 30,
    score: { gold: 900, silver: 700, bronze: 400 },
    solution: [],
  };

  return { ...base, ...overrides };
}

/** 静止した板を 1 枚だけ持つステージ。 */
export function boardAt(
  id: string,
  x: number,
  y: number,
  width = 180,
  height = 20,
  angle = 0,
): PhysicsObjectDefinition {
  return { id, kind: "board", x, y, width, height, angle, isStatic: true };
}

export function placement(
  id: string,
  kind: Placement["kind"],
  x: number,
  y: number,
  angle = 0,
  params?: Record<string, number>,
): Placement {
  return { id, kind, x, y, angle, params };
}
