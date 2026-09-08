import { describe, it, expect } from "vitest";

import {
  STORAGE_KEY,
  createMemoryStorage,
  defaultSave,
  loadSave,
  saveProgress,
  recordClear,
  stageSelectState,
  isUnlocked,
} from "@/lib/storage";

/**
 * G-08 — 解放と保存の往復。原仕様 §37 / §38。
 * G-11 — 保存キーが `physicsPuzzleLab.v1` のみで、個人情報を含まない。SPEC N-04。
 *
 * LocalStorage は node には無いので、保存層は Storage 相当の口を受け取る形にしてある。
 * **実装をテストのために変えたのではなく**、ブラウザ以外でも進捗を検算できるようにするため
 * である(物理コアを DOM 非依存にしたのと同じ理由 — SPEC D-06)。
 */

describe("T-053 保存と復元が往復する(G-08)", () => {
  it("既定値は Stage 01 だけが開いた状態", () => {
    // 原仕様 §38「初期状態: Stage 01 のみ利用可能」。
    const s = defaultSave();
    expect(s.unlockedStage).toBe(1);
    expect(s.bestScores).toEqual({});
    expect(s.settings.sound).toBe(false);
  });

  it("保存した内容がそのまま戻る", () => {
    const store = createMemoryStorage();
    const data = {
      unlockedStage: 7,
      bestScores: { "1": 980, "2": 860, "3": 720 },
      settings: { sound: true, slowMotion: false },
    };

    saveProgress(data, store);
    expect(loadSave(store)).toEqual(data);
  });

  it("空の保存領域からは既定値が返る", () => {
    expect(loadSave(createMemoryStorage())).toEqual(defaultSave());
  });

  it("壊れた保存内容は既定値へ落ちる(例外にしない)", () => {
    // 保存領域は利用者の環境にあり、書き換えも欠損もありうる。
    // ここで落ちると、遊べなくなるのは進捗ではなくアプリ全体である。
    const store = createMemoryStorage();
    store.setItem(STORAGE_KEY, "{ではないもの");
    expect(loadSave(store)).toEqual(defaultSave());

    store.setItem(STORAGE_KEY, JSON.stringify({ unlockedStage: "七" }));
    expect(loadSave(store).unlockedStage).toBe(1);
  });
});

describe("T-054 クリアで次の面が開く(G-08)", () => {
  it("Stage N をクリアすると N+1 が開く", () => {
    // 原仕様 §38。
    const store = createMemoryStorage();
    recordClear(1, 950, store);
    expect(loadSave(store).unlockedStage).toBe(2);

    recordClear(2, 800, store);
    expect(loadSave(store).unlockedStage).toBe(3);
  });

  it("解放は戻らない(前の面をもう一度クリアしても下がらない)", () => {
    const store = createMemoryStorage();
    recordClear(1, 950, store);
    recordClear(2, 800, store);
    recordClear(1, 300, store);
    expect(loadSave(store).unlockedStage).toBe(3);
  });

  it("ベストスコアは高いほうだけが残る", () => {
    const store = createMemoryStorage();
    recordClear(1, 700, store);
    recordClear(1, 950, store);
    recordClear(1, 400, store);
    expect(loadSave(store).bestScores["1"]).toBe(950);
  });

  it("最終面をクリアしても解放は 20 を超えない", () => {
    const store = createMemoryStorage();
    recordClear(20, 900, store);
    expect(loadSave(store).unlockedStage).toBe(20);
  });

  it("開いていない面は LOCKED、次の面は NEW", () => {
    // 原仕様 §39 のステージ選択画面。
    const store = createMemoryStorage();
    recordClear(1, 950, store);
    const save = loadSave(store);

    expect(stageSelectState(1, save, { gold: 900, silver: 700, bronze: 400 })).toBe("GOLD");
    expect(stageSelectState(2, save, { gold: 900, silver: 700, bronze: 400 })).toBe("NEW");
    expect(stageSelectState(3, save, { gold: 900, silver: 700, bronze: 400 })).toBe("LOCKED");

    expect(isUnlocked(2, save)).toBe(true);
    expect(isUnlocked(3, save)).toBe(false);
  });
});

describe("T-055 保存の中身に個人情報を持たない(G-11)", () => {
  it("書き込むキーは physicsPuzzleLab.v1 だけ", () => {
    const store = createMemoryStorage();
    recordClear(3, 800, store);
    saveProgress({ ...defaultSave(), unlockedStage: 5 }, store);

    expect(store.keys()).toEqual([STORAGE_KEY]);
    expect(STORAGE_KEY).toBe("physicsPuzzleLab.v1");
  });

  it("保存される項目は進捗・成績・設定だけ", () => {
    // 「個人情報を保存しない」は宣言では守られないので、
    // **書き出した内容の鍵を数えて**固定する。項目が増えたらここが落ちる。
    const store = createMemoryStorage();
    recordClear(2, 700, store);

    const written = JSON.parse(store.getItem(STORAGE_KEY)!);
    expect(Object.keys(written).sort()).toEqual(["bestScores", "settings", "unlockedStage"]);
    expect(Object.keys(written.settings).sort()).toEqual(["slowMotion", "sound"]);
  });
});
