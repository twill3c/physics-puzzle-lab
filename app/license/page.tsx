import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ライセンス — Physics Puzzle Lab",
  description: "本体は MIT License。依存ライブラリのライセンス表記。",
};

/**
 * ライセンス。原仕様 §68。
 *
 * 依存の版は `package.json` の実物に合わせて書く。**版を書いたら、
 * それが実際に入っている版であることを確かめてから書く**(勝手に上げない)。
 */
const THIRD_PARTY = [
  {
    name: "Matter.js",
    license: "MIT License",
    url: "https://github.com/liabru/matter-js",
    note: "2D 物理演算",
  },
  {
    name: "Next.js",
    license: "MIT License",
    url: "https://github.com/vercel/next.js",
    note: "アプリケーション基盤",
  },
  {
    name: "React / React DOM",
    license: "MIT License",
    url: "https://github.com/facebook/react",
    note: "UI",
  },
];

export default function LicensePage() {
  return (
    <main className="wrap prose">
      <h1>ライセンス</h1>
      <p className="sub">本体は MIT License です。</p>

      <h2>Physics Puzzle Lab</h2>
      <p>
        MIT License © 2026 坂田哲朗 ——{" "}
        <a href="https://github.com/twill3c/physics-puzzle-lab/blob/main/LICENSE">
          LICENSE 全文
        </a>
      </p>

      <h2>Third-party libraries</h2>
      <table>
        <thead>
          <tr>
            <th>ライブラリ</th>
            <th>ライセンス</th>
            <th>用途</th>
          </tr>
        </thead>
        <tbody>
          {THIRD_PARTY.map((lib) => (
            <tr key={lib.name}>
              <td>
                <a href={lib.url}>{lib.name}</a>
              </td>
              <td>{lib.license}</td>
              <td>{lib.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>素材について</h2>
      <p>
        画像・音声・フォントの外部素材は<strong>一つも使っていません</strong>。
        画面はすべて Canvas と CSS で描き、効果音は Web Audio API で生成しています。
        そのため外部への通信も、CDN への依存もありません。
      </p>

      <p className="muted">
        <Link href="/">← ホームへ</Link> ・ <Link href="/about">About</Link>
      </p>
    </main>
  );
}
