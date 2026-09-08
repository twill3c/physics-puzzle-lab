import { STORAGE_KEY as KEY } from "./constants";
import type { Rank, SaveData, StageSelectState } from "@/types/game";
import { rankFor, type RankThresholds } from "@/game/scoreManager";

/**
 * 進捗の保存。原仕様 §37(LocalStorage)/ §38(アンロック)/ §39(ステージ選択)。
 *
 * **保存するのは進捗・成績・設定だけ。** 個人情報は持たない(SPEC N-04)。
 * これは宣言では守られないので、書き出した内容の鍵を数える検査を置いてある
 * (tests/game/storage.test.ts の T-055)。項目を増やせばそこが落ちる。
 *
 * 保存層は `Storage` 相当の口を受け取る。ブラウザ以外(テスト・無頭実行)でも
 * 進捗を検算できるようにするためで、物理コアを DOM 非依存にしたのと同じ理由である
 * (SPEC D-06)。
 */

export const STORAGE_KEY = KEY;

/** 読み書きに使う最小限の口。`window.localStorage` がそのまま当てはまる。 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** テストと無頭実行のための、その場限りの保存領域。 */
export function createMemoryStorage(): KeyValueStore & { keys(): string[] } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    keys: () => [...map.keys()],
  };
}

/**
 * 既定の保存内容。原仕様 §38「初期状態: Stage 01 のみ利用可能」。
 *
 * 音は既定で OFF にする(原仕様 §41 は ON/OFF の提供を求めており、
 * 断りなく音が出るほうが驚きが大きい)。
 */
export function defaultSave(): SaveData {
  return { unlockedStage: 1, bestScores: {}, settings: { sound: false, slowMotion: false } };
}

/** ブラウザなら `localStorage`、無ければ null。 */
function browserStore(): KeyValueStore | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return (globalThis as { localStorage: KeyValueStore }).localStorage;
    }
  } catch {
    // プライベートモード等で参照そのものが投げることがある。
  }
  return null;
}

/**
 * 保存内容を読む。
 *
 * **壊れていたら既定値へ落とす。例外にしない。** 保存領域は利用者の環境にあり、
 * 書き換えも欠損もありうる。ここで落ちると、遊べなくなるのは進捗ではなくアプリ全体になる。
 */
export function loadSave(store: KeyValueStore | null = browserStore()): SaveData {
  if (!store) return defaultSave();

  let raw: string | null = null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return defaultSave();
  }
  if (!raw) return defaultSave();

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();

    const unlocked =
      typeof parsed.unlockedStage === "number" && Number.isFinite(parsed.unlockedStage)
        ? Math.max(1, Math.floor(parsed.unlockedStage))
        : base.unlockedStage;

    const scores: Record<string, number> = {};
    if (parsed.bestScores && typeof parsed.bestScores === "object") {
      for (const [k, v] of Object.entries(parsed.bestScores)) {
        if (typeof v === "number" && Number.isFinite(v)) scores[k] = v;
      }
    }

    return {
      unlockedStage: unlocked,
      bestScores: scores,
      settings: {
        sound: parsed.settings?.sound === true,
        slowMotion: parsed.settings?.slowMotion === true,
      },
    };
  } catch {
    return defaultSave();
  }
}

/** 保存内容を書く。書けない環境では黙って諦める(進捗が残らないだけで遊べる)。 */
export function saveProgress(data: SaveData, store: KeyValueStore | null = browserStore()): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量超過・書き込み禁止。ここで落とす理由が無い。
  }
}

/**
 * クリアを記録する。原仕様 §38。
 *
 * - 次の面を開く。**解放は戻らない**(前の面をもう一度クリアしても下がらない)
 * - ベストスコアは高いほうだけを残す
 */
export function recordClear(
  stageId: number,
  score: number,
  store: KeyValueStore | null = browserStore(),
  maxStage = 20,
): SaveData {
  const save = loadSave(store);

  const next = Math.min(stageId + 1, maxStage);
  save.unlockedStage = Math.max(save.unlockedStage, next);

  const key = String(stageId);
  const prev = save.bestScores[key];
  if (prev === undefined || score > prev) save.bestScores[key] = score;

  saveProgress(save, store);
  return save;
}

/** その面が開いているか。 */
export function isUnlocked(stageId: number, save: SaveData): boolean {
  return stageId <= save.unlockedStage;
}

/** ステージ選択画面に出す状態。原仕様 §39。 */
export function stageSelectState(
  stageId: number,
  save: SaveData,
  thresholds: RankThresholds,
): StageSelectState {
  if (!isUnlocked(stageId, save)) return "LOCKED";

  const best = save.bestScores[String(stageId)];
  if (best === undefined) return "NEW";

  return rankFor(best, thresholds) as Rank as StageSelectState;
}
