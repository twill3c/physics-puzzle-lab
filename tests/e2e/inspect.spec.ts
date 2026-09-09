import { test } from "@playwright/test";

/**
 * 目視検品のための撮影(G-14 / HC-041)。
 *
 * **これは合否を判定しない。** 撮るだけである。判定するのは人間の目で、
 * 見るべきものは機械の代理指標では捕まらないもの —— **並び・優先順位・読みやすさ** —— に限る
 * (HC-250)。幾何(横の溢れ・縦の伸びすぎ)は game.spec.ts が測る。
 *
 * 確認項目:
 *
 * 1. 狭い幅で **Canvas → TOOLS → 操作ボタン** の並びになっているか(原仕様 §43)
 * 2. 盤面の部品(ボール・ゴール・足場)が見分けられるか
 * 3. 残数・状態・ランクが**色以外**でも読み取れるか(SPEC N-06)
 * 4. フッタが本文に重なっていないか
 *
 * `fullPage` は使わない。固定フッタが途中へ焼き込まれ、**偽の異常**が出る
 * (メモリ: fleet-screenshot-artifacts)。
 */
test("検品用の撮影", async ({ page }) => {
  const shots: [string, { width: number; height: number }, string][] = [
    ["/game?stage=5", { width: 1280, height: 900 }, "desktop-game"],
    ["/stages", { width: 1280, height: 900 }, "desktop-stages"],
    ["/lab", { width: 1280, height: 900 }, "desktop-lab"],
    ["/how-to-play", { width: 1280, height: 900 }, "desktop-howto"],
    ["/game?stage=2", { width: 390, height: 820 }, "mobile-game"],
    ["/stages", { width: 390, height: 820 }, "mobile-stages"],
    ["/lab", { width: 390, height: 820 }, "mobile-lab"],
  ];

  for (const [path, size, name] of shots) {
    await page.setViewportSize(size);
    await page.goto(path);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/inspect-${name}.png` });
  }
});
