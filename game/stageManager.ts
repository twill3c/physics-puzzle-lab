import type { Stage } from "@/types/stage";

import { validateStage } from "./validation";

import stage01 from "@/data/stages/stage01.json";
import stage02 from "@/data/stages/stage02.json";
import stage03 from "@/data/stages/stage03.json";
import stage04 from "@/data/stages/stage04.json";
import stage05 from "@/data/stages/stage05.json";
import stage06 from "@/data/stages/stage06.json";
import stage07 from "@/data/stages/stage07.json";
import stage08 from "@/data/stages/stage08.json";
import stage09 from "@/data/stages/stage09.json";
import stage10 from "@/data/stages/stage10.json";
import stage11 from "@/data/stages/stage11.json";
import stage12 from "@/data/stages/stage12.json";
import stage13 from "@/data/stages/stage13.json";
import stage14 from "@/data/stages/stage14.json";
import stage15 from "@/data/stages/stage15.json";
import stage16 from "@/data/stages/stage16.json";
import stage17 from "@/data/stages/stage17.json";
import stage18 from "@/data/stages/stage18.json";
import stage19 from "@/data/stages/stage19.json";
import stage20 from "@/data/stages/stage20.json";

/**
 * ステージの読み込み。原仕様 §54(ステージロード)。
 *
 * **静的 import で並べる。** 動的読み込みにすると、面が 1 枚壊れていても
 * その面を開くまで分からない。ここに並べておけば、ビルドと G-01 が全面を見る。
 *
 * 順序は id 順で固定する —— 並び順が変わると「次の面」が変わってしまう。
 */
const RAW: unknown[] = [
  stage01, stage02, stage03, stage04, stage05,
  stage06, stage07, stage08, stage09, stage10,
  stage11, stage12, stage13, stage14, stage15,
  stage16, stage17, stage18, stage19, stage20,
];

const STAGES: Stage[] = RAW.map((s) => s as Stage);

/** 収録している全ステージ(id 昇順)。 */
export function allStages(): Stage[] {
  return STAGES;
}

/** 収録面数。 */
export function stageCount(): number {
  return STAGES.length;
}

/**
 * id で 1 面を取る。
 *
 * 存在しない id は**例外にする**。`undefined` を返すと、呼ぶ側が
 * 「まだ読み込めていない」と取り違えて空の画面を出す道が残る(HC-075)。
 */
export function getStage(id: number): Stage {
  const stage = STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`ステージ ${id} は存在しない(収録は 1〜${STAGES.length})`);
  return stage;
}

/**
 * 読み込み時の検証(原仕様 §54 の Validate)。
 *
 * 不正なステージは**世界を組む前に**弾く。Matter.js は範囲外の値を渡されても
 * 例外を投げず、黙って壊れた世界を作るからである(game/validation.ts)。
 */
export function loadStage(id: number): Stage {
  const stage = getStage(id);
  const result = validateStage(stage);

  if (!result.ok) {
    const detail = result.errors.map((e) => `${e.path}: ${e.message}`).join(" / ");
    throw new Error(`ステージ ${id} の定義が不正: ${detail}`);
  }

  return stage;
}
