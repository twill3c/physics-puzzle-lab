import { test, expect, type Page } from "@playwright/test";

/**
 * 実ブラウザ検品(G-14)。原仕様 §59。
 *
 * **在ることではなく、幾何と到達を測る**(HC-138)。
 * 「要素がある」「文字が出ている」は、図が潰れていても重なっていても緑になる。
 *
 * 座標を使う操作は、**操作が届いた証拠**(状態の変化)を確かめてから結果を判定する。
 * 画面外への操作は何にも当たらず沈黙し、その沈黙は「操作したが変化なし」と区別できない。
 */

/** 横の溢れを測る。ページ本体が横スクロールしていないこと(HC-078)。 */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

test.describe("到達と表示", () => {
  test("E-01 ホームから主要な画面へ到達できる", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PHYSICS");

    await page.getByRole("link", { name: /STAGES/ }).click();
    await expect(page).toHaveURL(/\/stages/);

    // 20 面が並ぶ。数は「面が読み込めている」ことの証拠でもある。
    const cards = page.locator(".stagecard");
    await expect(cards).toHaveCount(20);

    // Stage 01 だけが開いていて、残りは LOCKED(原仕様 §38 の初期状態)。
    await expect(page.locator('.stagecard__state[data-state="NEW"]')).toHaveCount(1);
    await expect(page.locator('.stagecard__state[data-state="LOCKED"]')).toHaveCount(19);

    await page.locator("a.stagecard").first().click();
    await expect(page).toHaveURL(/\/game\?stage=1/);
    await expect(page.locator("canvas.game-canvas")).toBeVisible();
  });

  test("E-02 盤面が実際に描かれている(幾何を測る)", async ({ page }) => {
    await page.goto("/game?stage=1");
    const canvas = page.locator("canvas.game-canvas");
    await expect(canvas).toBeVisible();

    // 大きさが潰れていないこと。要素の存在だけでは 0×0 でも緑になる。
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(150);

    // 描画されている証拠として、背景以外の色が出ていることを画素で確かめる。
    const painted = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set<string>();
      for (let i = 0; i < data.length; i += 4 * 97) {
        seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      }
      return seen.size;
    });
    // 単色なら 1。図が描かれていれば色数はもっと増える。
    expect(painted).toBeGreaterThan(3);
  });
});

test.describe("遊べること", () => {
  test("E-03 Stage 01 を最後まで走らせるとクリアになる", async ({ page }) => {
    await page.goto("/game?stage=1");

    // 開始前は「部品を置いて Start」。
    await expect(page.getByRole("status").first()).toContainText("Start");

    await page.getByRole("button", { name: /^Start/ }).click();

    // 操作が届いた証拠を先に確かめる(HC-138)。
    await expect(page.getByRole("status").first()).toContainText("実行中");

    // stage01 は落ちるだけでクリアする。演出と成績が出るまで待つ。
    await expect(page.locator(".score__rank")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("status").first()).toContainText("クリア");

    const rank = await page.locator(".score__rank").innerText();
    expect(["GOLD", "SILVER", "BRONZE", "CLEAR"]).toContain(rank.trim());

    // クリアで次の面が開く(原仕様 §38)。
    await page.goto("/stages");
    await expect(page.locator('.stagecard__state[data-state="NEW"]')).toHaveCount(1);
    await expect(page.locator('.stagecard__state[data-state="LOCKED"]')).toHaveCount(18);
  });

  test("E-04 部品を置くと残数が減る(操作が物理に届いている)", async ({ page }) => {
    await page.goto("/game?stage=2");

    const board = page.getByRole("button", { name: /BOARD/ });
    await expect(board).toContainText("2 / 2");

    await board.click();
    await expect(board).toHaveAttribute("aria-pressed", "true");

    const canvas = page.locator("canvas.game-canvas");
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;

    // 盤面の中ほどを押して 1 枚置く。
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);

    // **状態が変わったことで**操作が届いたと判定する(画素ではなく)。
    await expect(board).toContainText("1 / 2");
  });

  test("E-05 キーボードで開始できる(原仕様 §45)", async ({ page }) => {
    await page.goto("/game?stage=1");
    await page.locator("body").click({ position: { x: 5, y: 5 } });

    await page.keyboard.press("Space");
    await expect(page.getByRole("status").first()).toContainText("実行中");

    await page.keyboard.press("Space");
    await expect(page.getByRole("status").first()).toContainText("一時停止");

    await page.keyboard.press("r");
    await expect(page.getByRole("status").first()).not.toContainText("一時停止");
  });
});

test.describe("画面の幅(HC-078)", () => {
  // **一つの幅だけ見ない。** 列の潰れも図の細り方も、幅によってしか現れない。
  const widths = [
    { name: "スマートフォン", width: 375, height: 780 },
    { name: "タブレット", width: 768, height: 1024 },
    { name: "デスクトップ", width: 1280, height: 900 },
  ];

  for (const w of widths) {
    test(`E-06 ${w.name}(${w.width}px)で横に溢れない`, async ({ page }) => {
      await page.setViewportSize({ width: w.width, height: w.height });

      for (const path of ["/", "/stages", "/game?stage=2"]) {
        await page.goto(path);
        await page.waitForTimeout(300);

        const overflow = await horizontalOverflow(page);
        expect(overflow, `${path} が ${overflow}px 横に溢れている`).toBeLessThanOrEqual(1);

        // 縦の伸びすぎも見る(列の潰れがよく出る)。
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(height, `${path} が縦に伸びすぎている`).toBeLessThan(16_000);
      }
    });
  }

  test("E-07 溢れ検査そのものの検査 — 陽性対照", async ({ page }) => {
    // HC-080: 「異常なし」を返したとき、その検品器が実際に異常を捕まえられることを
    // 一度確かめる。これが撃たないなら、E-06 の緑は何も意味しない。
    await page.setViewportSize({ width: 375, height: 780 });
    await page.goto("/");

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await page.evaluate(() => {
      const el = document.createElement("div");
      el.style.width = "3000px";
      el.style.height = "10px";
      el.id = "overflow-probe";
      document.body.appendChild(el);
    });

    expect(await horizontalOverflow(page)).toBeGreaterThan(1000);
  });
});
