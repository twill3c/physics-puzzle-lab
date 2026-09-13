import { test, expect } from "@playwright/test";

/**
 * 同一性の検品(G-14 / HC-148)。**本番に当てるときは、これを最初に単独で走らせる。**
 *
 * 本番検品は「健やかか」しか答えない。初回デプロイで恐いのは古さではなく**取り違え**である ——
 * 別名が他人のアプリを指していても 200 が返り、健やかさの検査は全部緑になる
 * (メモリ: app-menu.vercel.app は他者の「White Label App」だった)。
 *
 * だから**このアプリにしか無い一続きの文**を目印にする。一続きにするのは、
 * 生 HTML では要素をまたぐ表示が分かれて見つからないからで、ここでは描画後の
 * 本文(innerText)で探す。
 *
 * 陽性対照: 別のアプリの URL を PROD_URL に与えると、必ず落ちること。
 */
const MARKERS = [
  { path: "/", text: "物理で遊ぶ。実験して理解する。" },
  { path: "/about", text: "配る面は、解けることを確かめてから配っている" },
];

test.describe.configure({ mode: "serial" });

for (const m of MARKERS) {
  test(`P-01 ${m.path} が Physics Puzzle Lab である`, async ({ page }) => {
    const res = await page.goto(m.path);
    expect(res?.status(), `${m.path} の HTTP 状態`).toBe(200);
    await expect(page.locator("body")).toContainText(m.text);
  });
}
