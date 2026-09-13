import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

/**
 * 本番の URL。与えられたら手元のサーバを立てず、本番に対して同じ検品を当てる。
 *
 * **本番検品は「健やかか」しか答えない**(HC-148)。とくに初回デプロイでは、
 * 別名が他人のアプリを指していても 200 が返る。だから本番に当てるときは、
 * まず prod-identity.spec.ts を単独で走らせ、配っているのが本当にこのアプリかを
 * 確かめてから残りを走らせる。
 */
const PROD_URL = process.env.PROD_URL;

/**
 * 実ブラウザ検品(SPEC G-14 / 原仕様 §59)。
 *
 * **出荷ビルドに対して当てる。** `next dev` ではなく `next start` を使うのは、
 * 手元で動くことと配られる木で動くことが別だからである(HC-062)。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: PROD_URL ?? `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: PROD_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
