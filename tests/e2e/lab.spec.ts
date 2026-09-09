import { test, expect, type Page } from "@playwright/test";

/**
 * Lab Mode と文章ページの実ブラウザ検品(G-14)。
 *
 * **値を変えたら物理が変わる**ことを、読み出しの数で確かめる。
 * スライダーが動くことと、物理が変わることは別である —— 前者だけを見ると、
 * つながっていない飾りのスライダーでも緑になる。
 */

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

/** 読み出しを名前で引く。 */
async function readout(page: Page, label: string): Promise<number> {
  const dd = page.locator(".lab-readouts div", { has: page.locator("dt", { hasText: label }) }).locator("dd");
  const text = await dd.first().innerText();
  return Number.parseFloat(text.replace(/[^\d.-]/g, ""));
}

test.describe("Lab Mode", () => {
  test("E-10 実験台が描かれ、状態量が動く", async ({ page }) => {
    await page.goto("/lab");
    await expect(page.locator("canvas.game-canvas")).toBeVisible();

    // 8 項目(原仕様 §34)がそろっている。
    await expect(page.locator(".lab-readouts > div")).toHaveCount(8);

    const first = await readout(page, "Position Y");
    await page.waitForTimeout(700);
    const later = await readout(page, "Position Y");

    // 止まっている表示ではない = 物理が回っている。
    expect(later).not.toBe(first);
  });

  test("E-11 重力を 0 にするとボールが落ちなくなる(値が物理に届いている)", async ({ page }) => {
    await page.goto("/lab");

    // Zero Gravity プリセットを押す。
    await page.getByRole("button", { name: "Zero Gravity" }).click();
    await page.waitForTimeout(700);

    const a = await readout(page, "Velocity Y");
    await page.waitForTimeout(500);
    const b = await readout(page, "Velocity Y");

    // 重力が無ければ縦の速度は増えない。落下中なら増え続ける。
    expect(Math.abs(b)).toBeLessThan(0.5);
    expect(Math.abs(b - a)).toBeLessThan(0.2);
  });

  test("E-12 重力を上げると落下が速くなる", async ({ page }) => {
    await page.goto("/lab");

    /**
     * **落下中に測る。** 重力 2.0 ではおよそ 0.5 秒で実験台に着き、
     * 速度は 0 へ戻る。実時間 900ms 後に測ると「重いほうが遅い」という
     * もっともらしい数が出る(VERIF-FALSE、loop_007 / HC-234)。
     * だから短い窓で測り、**まだ落ちている途中であること**を assert で固定する。
     */
    const sampleWhileFalling = async (preset: string) => {
      await page.getByRole("button", { name: preset }).click();
      await page.waitForTimeout(250);

      const y = await readout(page, "Position Y");
      // 実験台の上面はおよそ y=370。まだ届いていないこと。
      expect(y, `${preset} が測定前に着地している(y=${y})`).toBeLessThan(340);

      return Math.abs(await readout(page, "Velocity Y"));
    };

    const moon = await sampleWhileFalling("Moon");
    const heavy = await sampleWhileFalling("Heavy World");

    // 月(0.165)より Heavy(2.0)のほうがはっきり速い。
    expect(heavy).toBeGreaterThan(moon * 2);
  });

  test("E-13 スライダーが 10 本ある(原仕様 §32)", async ({ page }) => {
    await page.goto("/lab");
    await expect(page.locator('.lab-slider input[type="range"]')).toHaveCount(10);
  });
});

test.describe("文章のページ", () => {
  const pages = [
    { path: "/about", heading: "About", must: "SI 単位ではない" },
    { path: "/how-to-play", heading: "遊び方", must: "0.3 秒" },
    { path: "/license", heading: "ライセンス", must: "MIT License" },
  ];

  for (const p of pages) {
    test(`E-14 ${p.path} が読める`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(p.heading);
      await expect(page.locator("main")).toContainText(p.must);
    });
  }

  test("E-15 ホームから全ページへ到達できる(原仕様 §40)", async ({ page }) => {
    for (const [name, url] of [
      ["PHYSICS LAB", /\/lab/],
      ["STAGES", /\/stages/],
      ["HOW TO PLAY", /\/how-to-play/],
      ["ABOUT", /\/about/],
    ] as const) {
      await page.goto("/");
      await page.getByRole("link", { name: new RegExp(name) }).click();
      await expect(page).toHaveURL(url);
    }
  });
});

test.describe("新しいページの幅", () => {
  for (const w of [375, 768, 1280]) {
    test(`E-16 ${w}px で横に溢れない`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });

      for (const path of ["/lab", "/about", "/how-to-play", "/license"]) {
        await page.goto(path);
        await page.waitForTimeout(300);

        const overflow = await horizontalOverflow(page);
        expect(overflow, `${path} が ${overflow}px 横に溢れている`).toBeLessThanOrEqual(1);
      }
    });
  }
});
