import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Physics Puzzle Lab",
  description:
    "2D 物理シミュレーションでボールをゴールへ導くパズルと、重力・摩擦・反発を自由に動かせる実験室。すべてブラウザ内で動く。",
};

/**
 * フリート共通フッタの行き先(koho-lens が正本)。
 *
 * 規約は 5 項目「MIT License © 2026 坂田哲朗 ・ GitHub ・ <歩き方> ・ <設計図> ・ App Menu」。
 * 歩き方・設計図は解説アーティファクト(loop_009 で発行)。既定は非公開なので、
 * 他の人が開けるかどうかは各ページの共有設定で決まる。
 */
const FOOTER = {
  license: "https://github.com/twill3c/physics-puzzle-lab/blob/main/LICENSE",
  repository: "https://github.com/twill3c/physics-puzzle-lab",
  guide: "https://claude.ai/code/artifact/579a718e-b749-47eb-a5c6-ddb8f48779fb",
  blueprint: "https://claude.ai/code/artifact/d1ec0048-a7f5-42b6-a3b5-02a9e9db43d4",
  appMenu: "https://app-menu-amber.vercel.app/",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <a href={FOOTER.license}>MIT License</a>
            <span className="site-footer__copy">© 2026 坂田哲朗</span>
            <span className="fsep">・</span>
            <a href={FOOTER.repository}>GitHub</a>
            <span className="fsep">・</span>
            <a href={FOOTER.guide}>Physics Puzzle Lab の解き方</a>
            <span className="fsep">・</span>
            <a href={FOOTER.blueprint}>Physics Puzzle Lab の設計図</a>
            <span className="fsep">・</span>
            <a href={FOOTER.appMenu}>App Menu</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
