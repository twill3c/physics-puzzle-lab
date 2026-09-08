import {
  OBJECT_PENALTY_PER_OBJECT,
  RESET_PENALTY_PER_RESET,
  SCORE_BASE,
  TICKS_PER_SECOND,
  TIME_PENALTY_PER_SECOND,
} from "@/lib/constants";
import type { Rank, ScoreBreakdown, ScoreInput } from "@/types/game";

/**
 * Physics Score。原仕様 §23 / §24。
 *
 *   Score = BaseScore − TimePenalty − ObjectPenalty − ResetPenalty
 *   BaseScore    = 1000
 *   TimePenalty  = elapsedSeconds × 5
 *   ObjectPenalty = usedObjects × 20
 *   ResetPenalty = resetCount × 30
 *
 * `usedObjects` は**プレイヤーが置いた数**である。ステージが最初から置いている
 * 固定物を数えると、同じ盤面が面によって別の点になる(types/physics.ts の注)。
 */

/**
 * 経過秒は**切り捨てる**(SPEC D-09)。
 *
 * 原仕様 §23 は丸め方を書いていない。秒は tick から導く連続量なので、
 * 決めておかないと同じ操作が別の点になる。切り捨てを採るのは、
 * プレイヤーに不利な方向へ勝手に丸めないためである。
 */
export function secondsFromTicks(ticks: number): number {
  return ticks / TICKS_PER_SECOND;
}

export function computeScore(input: ScoreInput, thresholds?: RankThresholds): ScoreBreakdown {
  const timePenalty = Math.floor(input.elapsedSeconds) * TIME_PENALTY_PER_SECOND;
  const objectPenalty = input.usedObjects * OBJECT_PENALTY_PER_OBJECT;
  const resetPenalty = input.resetCount * RESET_PENALTY_PER_RESET;

  // 原仕様 §24 の最下位帯が 0-399 なので、負の点は帯の外に出てしまう。下限を 0 に置く。
  const total = Math.max(0, SCORE_BASE - timePenalty - objectPenalty - resetPenalty);

  return {
    base: SCORE_BASE,
    timePenalty,
    objectPenalty,
    resetPenalty,
    total,
    rank: thresholds ? rankFor(total, thresholds) : rankFor(total),
  };
}

export interface RankThresholds {
  gold: number;
  silver: number;
  bronze: number;
}

/**
 * ランク。原仕様 §24。
 *
 * しきい値は**その点以上**でその帯に入る(900 は GOLD、899 は SILVER)。
 * 既定値はステージ JSON が持ち、SPEC D-03 により §24 の帯と一致させてある。
 */
export function rankFor(
  score: number,
  thresholds: RankThresholds = { gold: 900, silver: 700, bronze: 400 },
): Rank {
  if (score >= thresholds.gold) return "GOLD";
  if (score >= thresholds.silver) return "SILVER";
  if (score >= thresholds.bronze) return "BRONZE";
  return "CLEAR";
}
