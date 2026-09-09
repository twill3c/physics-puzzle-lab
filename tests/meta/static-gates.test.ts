import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const SKIP = new Set(["node_modules", ".next", ".git", "out", "coverage", "logs", "harness"]);

/** 出荷される木のソースを集める。 */
function sourceFiles(dir = ROOT, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.(ts|tsx|css|json)$/.test(name)) acc.push(full);
  }
  return acc;
}

const FILES = sourceFiles();
const APP_FILES = FILES.filter(
  (f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.endsWith("package-lock.json"),
);

function read(f: string): string {
  return readFileSync(f, "utf8");
}

/**
 * G-10 — 外部通信・外部素材・`dangerouslySetInnerHTML` を持たない(SPEC N-03 / N-05)。
 *
 * **宣言では守られない。** 「外部素材を使わない」と README に書いても、
 * 誰かが `<img src="https://…">` を足せば静かに破れる。だから走査する。
 *
 * 検出系の検査は、対象に違反が無いときと検査が働いていないときで同じ緑を返すので、
 * 陽性対照を対に置く(HC-041)。
 */

describe("T-064 外部通信・外部素材を持たない(G-10)", () => {
  it("走査対象が空でない", () => {
    expect(APP_FILES.length).toBeGreaterThan(30);
  });

  it("http(s) の外部参照を持たない(文中の URL は除く)", () => {
    // 除外する線: コメント・文書中の言及と、フッタの行き先。
    // 「引用・言及」と「使用・依存」を分ける(HC-074)。
    const offenders: string[] = [];

    for (const f of APP_FILES) {
      if (f.endsWith(".json")) continue;
      const text = read(f);

      text.split(/\r?\n/).forEach((line, i) => {
        const trimmed = line.trim();
        // コメント行は言及とみなす。
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) return;

        // 実際に読み込む形だけを見る。
        const loads = /(src|href)\s*[=:]\s*["'`]https?:\/\//.test(line);
        const fetches = /\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(\s*["'`]https?:/.test(line);
        const cssUrl = /url\(\s*["']?https?:\/\//.test(line);

        // フッタの行き先(GitHub / LICENSE / App Menu)は外部リンクであって外部素材ではない。
        const isFooterLink = /FOOTER\s*=|github\.com|app-menu|claude\.ai/.test(line);

        if ((loads && !isFooterLink) || fetches || cssUrl) {
          offenders.push(`${path.relative(ROOT, f)}:${i + 1} ${trimmed.slice(0, 80)}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("検出そのものの検査 — 陽性対照", () => {
    // 捕まえるべき悪い例と、撃ってはならない正当な例を同じ場所で試す。
    const bad = [
      `<img src="https://example.com/a.png" />`,
      `fetch("https://api.example.com/x")`,
      `background: url(https://cdn.example.com/b.png);`,
    ];
    const good = [
      `// https://example.com を参照した`,
      `<a href="https://github.com/twill3c/physics-puzzle-lab">GitHub</a>`,
      `const local = "/icons/a.svg";`,
    ];

    const fires = (line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) return false;
      const loads = /(src|href)\s*[=:]\s*["'`]https?:\/\//.test(line);
      const fetches = /\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(\s*["'`]https?:/.test(line);
      const cssUrl = /url\(\s*["']?https?:\/\//.test(line);
      const isFooterLink = /FOOTER\s*=|github\.com|app-menu|claude\.ai/.test(line);
      return (loads && !isFooterLink) || fetches || cssUrl;
    };

    for (const b of bad) expect(fires(b), `捕まえられなかった: ${b}`).toBe(true);
    for (const g of good) expect(fires(g), `誤検出した: ${g}`).toBe(false);
  });

  it("dangerouslySetInnerHTML を使わない(SPEC N-05)", () => {
    const offenders = APP_FILES.filter((f) => {
      const text = read(f);
      // 「使用」だけを見る。コメントでの言及は違反ではない。
      return text.split(/\r?\n/).some((line) => {
        const t = line.trim();
        if (t.startsWith("*") || t.startsWith("//")) return false;
        return line.includes("dangerouslySetInnerHTML");
      });
    });

    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("出荷する依存は matter-js / next / react のみ(SPEC N-03)", () => {
    const pkg = JSON.parse(read(path.join(ROOT, "package.json")));
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "matter-js",
      "next",
      "react",
      "react-dom",
    ]);
  });
});

describe("T-065 アクセシビリティの静的要件(G-12)", () => {
  it("タップ領域の最小寸法が CSS に置かれている(原仕様 §46)", () => {
    const css = read(path.join(ROOT, "app", "globals.css"));
    // 44px 以上を満たす宣言が、押せる要素それぞれに在ること。
    for (const sel of [".menu__link", ".palette__item", ".toolbar__btn", ".game-nav__link"]) {
      const block = css.slice(css.indexOf(sel));
      const m = /min-height:\s*(\d+)px/.exec(block.slice(0, 400));
      expect(m, `${sel} に min-height が無い`).not.toBeNull();
      expect(Number(m![1]), `${sel} のタップ領域が 44px 未満`).toBeGreaterThanOrEqual(44);
    }
  });

  it("prefers-reduced-motion に応答する(原仕様 §46)", () => {
    const css = read(path.join(ROOT, "app", "globals.css"));
    expect(css).toContain("prefers-reduced-motion");
  });

  it("Canvas に説明がついている(色以外の手掛かり)", () => {
    const src = read(path.join(ROOT, "components", "GameCanvas.tsx"));
    expect(src).toContain("aria-label");
    expect(src).toContain('role="img"');
  });
});

describe("T-066 フリート共通フッタ(規約)", () => {
  it("レイアウトに MIT / GitHub / App Menu が並ぶ", () => {
    const src = read(path.join(ROOT, "app", "layout.tsx"));
    expect(src).toContain("MIT License");
    expect(src).toContain("© 2026 坂田哲朗");
    expect(src).toContain("App Menu");
  });

  it("LICENSE ファイルが実在する(リンク先が空でない)", () => {
    // フリートで LICENSE が無いのに MIT リンクを出していた例が 11 件あった。
    const license = read(path.join(ROOT, "LICENSE"));
    expect(license).toContain("MIT License");
    expect(license.length).toBeGreaterThan(500);
  });
});
