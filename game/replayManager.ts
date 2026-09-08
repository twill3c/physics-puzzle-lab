import { TICKS_PER_SECOND } from "@/lib/constants";
import type { BodyState, Placement, ToolKind } from "@/types/physics";
import type { Replay, ReplayEvent } from "@/types/replay";
import type { ScoreBreakdown } from "@/types/game";
import type { Stage } from "@/types/stage";
import { Simulation } from "@/physics/world";

import { computeScore } from "./scoreManager";

/**
 * Replay。原仕様 §26 / §27。
 *
 * V1.0 は動画を作らない。**操作ログを保存して再実行する。**
 * 再実行が記録元と同じ結果を出せるのは、物理が固定タイムステップで回っているからで
 * ある(SPEC D-01)。可変 delta のままログを再生しても、同じ操作から同じ軌跡は出ない。
 *
 * 物理に効くのは「START を押した時点の配置」だけである。編集の途中経過は
 * 見せるためのものであって、シミュレーションには入らない。したがって
 * 再生は (1) ログを畳んで配置を復元し (2) その配置で走らせる、の二段になる。
 */

/** 操作ログの記録係。 */
export interface Recorder {
  create(id: string, kind: ToolKind, x: number, y: number, angle?: number): void;
  move(id: string, x: number, y: number): void;
  rotate(id: string, angle: number): void;
  delete(id: string): void;
  start(): void;
  reset(): void;
  build(): Replay;
}

/**
 * 記録係を作る。
 *
 * `timestamp` は tick 番号で刻む。原仕様 §27 の例は ms だが、
 * 判定も物理も tick で数えているので(SPEC D-05)、単位を揃えておくほうが
 * 再生時の丸めが要らない。
 */
export function createRecorder(stageId: number, startTick = 0): Recorder {
  const events: ReplayEvent[] = [];
  let tick = startTick;

  const push = (e: Omit<ReplayEvent, "timestamp">) => {
    events.push({ timestamp: tick++, ...e });
  };

  return {
    create: (id, kind, x, y, angle = 0) => push({ type: "CREATE", objectId: id, kind, x, y, angle }),
    move: (id, x, y) => push({ type: "MOVE", objectId: id, x, y }),
    rotate: (id, angle) => push({ type: "ROTATE", objectId: id, angle }),
    delete: (id) => push({ type: "DELETE", objectId: id }),
    start: () => push({ type: "START" }),
    reset: () => push({ type: "RESET" }),
    build: () => ({ stageId, events: [...events] }),
  };
}

/**
 * 操作ログを畳んで最終的な配置を復元する。
 *
 * 挿入順を保つ —— 物体の生成順は決定論に効く(SPEC D-01)ので、
 * 復元した配置の並びが記録時と違うと、同じログから別の結果が出る。
 */
export function placementsFromEvents(events: ReplayEvent[]): Placement[] {
  const order: string[] = [];
  const byId = new Map<string, Placement>();

  for (const e of events) {
    switch (e.type) {
      case "CREATE": {
        if (!e.objectId || !e.kind) continue;
        if (!byId.has(e.objectId)) order.push(e.objectId);
        byId.set(e.objectId, {
          id: e.objectId,
          kind: e.kind,
          x: e.x ?? 0,
          y: e.y ?? 0,
          angle: e.angle ?? 0,
        });
        break;
      }
      case "MOVE": {
        const p = e.objectId ? byId.get(e.objectId) : undefined;
        if (!p) continue;
        byId.set(p.id, { ...p, x: e.x ?? p.x, y: e.y ?? p.y });
        break;
      }
      case "ROTATE": {
        const p = e.objectId ? byId.get(e.objectId) : undefined;
        if (!p) continue;
        byId.set(p.id, { ...p, angle: e.angle ?? p.angle });
        break;
      }
      case "DELETE": {
        if (!e.objectId) continue;
        byId.delete(e.objectId);
        break;
      }
      case "START":
      case "RESET":
        break;
    }
  }

  return order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
}

/** リセット回数。原仕様 §23 の ResetPenalty に渡す数である。 */
export function resetCountOf(events: ReplayEvent[]): number {
  return events.filter((e) => e.type === "RESET").length;
}

export interface ReplayResult {
  status: string;
  elapsedTicks: number;
  ball: BodyState;
  placements: Placement[];
  usedObjects: number;
  resetCount: number;
  score: ScoreBreakdown;
}

/**
 * ログを再生する(G-03 の本体)。
 *
 * 復元した配置で**出荷エンジンをそのまま**回す。再生専用の別経路を作らないのは、
 * ずれたときに誰も気づかないからである(HC-065)。
 */
export function replayRun(stage: Stage, replay: Replay): ReplayResult {
  const placements = placementsFromEvents(replay.events);
  const resetCount = resetCountOf(replay.events);

  const sim = new Simulation({ stage, placements });
  const result = sim.runUntilSettled();

  const score = computeScore(
    {
      elapsedSeconds: result.elapsedTicks / TICKS_PER_SECOND,
      usedObjects: placements.length,
      resetCount,
    },
    stage.score,
  );

  return {
    status: result.status,
    elapsedTicks: result.elapsedTicks,
    ball: sim.ballState(),
    placements,
    usedObjects: placements.length,
    resetCount,
    score,
  };
}
