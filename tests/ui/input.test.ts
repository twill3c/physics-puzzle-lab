import { describe, it, expect } from "vitest";

import { KEY_BINDINGS } from "@/types/tools";
import { resolveKeyAction } from "@/lib/input";

/**
 * F-28 — キーボード操作。原仕様 §45。
 *
 *   SPACE  Start / Pause
 *   R      Reset
 *   DELETE Delete Object
 *   ESC    Deselect
 *   S      Slow Motion
 */

describe("T-063 キー割り当てが原仕様 §45 と一致する(F-28)", () => {
  const cases: [string, string][] = [
    [" ", "startPause"],
    ["r", "reset"],
    ["R", "reset"],
    ["Delete", "delete"],
    ["Escape", "deselect"],
    ["s", "slowMotion"],
    ["S", "slowMotion"],
  ];

  for (const [key, action] of cases) {
    it(`${key === " " ? "SPACE" : key} は ${action}`, () => {
      expect(resolveKeyAction(key)).toBe(action);
    });
  }

  it("割り当ての無いキーは何も起こさない", () => {
    for (const k of ["a", "1", "Enter", "ArrowUp"]) {
      expect(resolveKeyAction(k)).toBeNull();
    }
  });

  it("表示用の文字列と割り当ては別に持つ", () => {
    // 表示を変えたときに割り当てが黙って変わらないようにする。
    expect(KEY_BINDINGS.startPause).toBe(" ");
    expect(KEY_BINDINGS.reset).toBe("r");
    expect(KEY_BINDINGS.delete).toBe("Delete");
    expect(KEY_BINDINGS.deselect).toBe("Escape");
    expect(KEY_BINDINGS.slowMotion).toBe("s");
  });

  it("入力欄に文字を打っているときは操作を横取りしない", () => {
    // ここを外すと、名前を打つだけでゲームが始まる。
    expect(resolveKeyAction("r", { inTextField: true })).toBeNull();
    expect(resolveKeyAction(" ", { inTextField: true })).toBeNull();
  });
});
