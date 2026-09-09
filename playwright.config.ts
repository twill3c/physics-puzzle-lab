import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

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
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
