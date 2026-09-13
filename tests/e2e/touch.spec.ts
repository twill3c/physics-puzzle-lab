import { test, expect, devices, type Page, type Locator } from "@playwright/test";

/**
 * タッチ操作の実ブラウザ検品(F-29 / G-14)。
 *
 * app-menu のカードは `mobile: true` を名乗っている。その根拠を「幅で溢れない」から
 * **「指で置けて・選べて・動かせる」**まで引き上げる。
 *
 * - タップは Playwright の `touchscreen.tap` を使う
 * - **ドラッグは Chromium の `Input.dispatchTouchEvent` で出す。** Playwright の touchscreen には
 *   tap しか無い。CDP のタッチ入力はブラウザ側で `pointerType: "touch"` のポインタイベントに
 *   変換されるので、マウスで代用するより実機に近い
 *
 * **判定は画素ではなく状態の変化で行う**(HC-138)。盤面の座標は画面に出ていないので、
 * 「その場所を指すと選択が付くか」を Delete ボタンの有効化で読む。
 *
 * 判別性は構成で持たせてある: ドラッグが効かなければ部品は元の場所に残り、
 * 元の場所を指すと選択が付く → E-17c が落ちる。
 */

test.use({ ...devices["Pixel 7"] });

async function canvasPoint(canvas: Locator, fx: number, fy: number) {
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const steps = 12;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test.describe("タッチ操作(F-29)", () => {
  test("E-17 指で置き、選び、ドラッグで動かせる", async ({ page }) => {
    await page.goto("/game?stage=2");

    const canvas = page.locator("canvas.game-canvas");
    const board = page.getByRole("button", { name: /BOARD/ });
    const del = page.getByRole("button", { name: /^Delete/ });

    // 前提: 実機相当の端末として開いている(タッチ有効)。
    expect(await page.evaluate(() => navigator.maxTouchPoints > 0)).toBe(true);

    // 前提: Canvas がブラウザのスクロールにジェスチャを奪われない。
    // touch-action が none でないと、実機では指のドラッグがページのスクロールになる。
    expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");

    // --- E-17a: タップで置ける ---
    await expect(board).toContainText("2 / 2");
    await board.tap();
    await expect(board).toHaveAttribute("aria-pressed", "true");

    const P = await canvasPoint(canvas, 0.3, 0.4);
    await page.touchscreen.tap(P.x, P.y);
    await expect(board).toContainText("1 / 2");

    // 道具を離し、何も無い所をタップして選択を外す(このあとの判定の起点を揃える)。
    await board.tap();
    await expect(board).toHaveAttribute("aria-pressed", "false");
    const empty = await canvasPoint(canvas, 0.85, 0.1);
    await page.touchscreen.tap(empty.x, empty.y);
    await expect(del).toBeDisabled();

    // --- E-17b: タップで選べる ---
    await page.touchscreen.tap(P.x, P.y);
    await expect(del).toBeEnabled();

    // --- E-17c: ドラッグで動かせる ---
    // 移動量は板の見かけの半幅より十分大きく取る(元の場所に板の端が残らないように)。
    const Q = await canvasPoint(canvas, 0.7, 0.25);
    expect(Q.x - P.x).toBeGreaterThan(100);
    await touchDrag(page, P, Q);

    // 選択を外してから、元の場所と新しい場所を順に指す。
    await page.touchscreen.tap(empty.x, empty.y);
    await expect(del).toBeDisabled();

    await page.touchscreen.tap(P.x, P.y);
    await expect(del, "元の場所にまだ部品がある = ドラッグが効いていない").toBeDisabled();

    await page.touchscreen.tap(Q.x, Q.y);
    await expect(del, "新しい場所に部品が無い = ドラッグ先に届いていない").toBeEnabled();

    // 残数は変わらない(ドラッグが「消して置き直し」になっていない)。
    await expect(board).toContainText("1 / 2");
  });

  /**
   * E-18 — 指だけで部品を回せる(原仕様 §44 / SPEC D-14)。
   *
   * 回転が Shift+ドラッグにしか無いと、タッチ端末では板を傾けられず大半の面が解けない
   * (VERIF-GAP、loop_009)。選択中の部品に角度スライダーを出して解決する。
   *
   * **回ったことは幾何で確かめる。** 板の中心 P から、回した軸に沿って 70(論理 px)離れた点 R は、
   * 回す前の板(厚み 20)には乗らず、回した後の板には乗る。同じ距離だけ回す前の軸に沿った点 U は、
   * 回した後の板には乗らない。スライダーが物理に繋がっていなければ R で選択が付かず落ちる。
   */
  test("E-18 指で角度を変えて部品を回せる", async ({ page }) => {
    await page.goto("/game?stage=2");

    const canvas = page.locator("canvas.game-canvas");
    const board = page.getByRole("button", { name: /BOARD/ });
    const del = page.getByRole("button", { name: /^Delete/ });
    const angle = page.getByLabel("角度");

    const P = await canvasPoint(canvas, 0.35, 0.45);
    const empty = await canvasPoint(canvas, 0.85, 0.1);
    const box = (await canvas.boundingBox())!;
    const s = box.width / 900; // 論理座標 → 画面座標の倍率

    const THETA = 0.6;
    const R = { x: P.x + 70 * s * Math.cos(THETA), y: P.y + 70 * s * Math.sin(THETA) };
    const U = { x: P.x + 70 * s, y: P.y };

    // 置く(置いた直後は選択されている)。
    await board.tap();
    await page.touchscreen.tap(P.x, P.y);
    await expect(board).toContainText("1 / 2");
    await expect(del).toBeEnabled();

    // 選択を外し、道具も離す。選択が無いとスライダーは出ない。
    await board.tap();
    await page.touchscreen.tap(empty.x, empty.y);
    await expect(del).toBeDisabled();
    await expect(angle).toBeHidden();

    // 前提: 回す前の板は R に乗っていない。
    await page.touchscreen.tap(R.x, R.y);
    await expect(del, "回す前から R に板がある = 幾何の前提が崩れている").toBeDisabled();

    // 選び直して、角度を 0.6 rad にする。
    await page.touchscreen.tap(P.x, P.y);
    await expect(del).toBeEnabled();
    await expect(angle).toBeVisible();
    await angle.fill(String(THETA));

    // 選択を外してから、回した後の幾何を確かめる。
    await page.touchscreen.tap(empty.x, empty.y);
    await expect(del).toBeDisabled();

    await page.touchscreen.tap(U.x, U.y);
    await expect(del, "回す前の軸の上にまだ板がある = 回っていない").toBeDisabled();

    await page.touchscreen.tap(R.x, R.y);
    await expect(del, "回した軸の上に板が無い = スライダーが物理に届いていない").toBeEnabled();
  });
});
