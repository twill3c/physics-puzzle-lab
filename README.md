# Physics Puzzle Lab

物理で遊ぶ。実験して理解する。

2D 物理シミュレーションの上でボールをゴールへ導くパズルと、重力・摩擦・反発を
自由に動かせる実験室(Lab Mode)。すべてブラウザ内で動き、サーバも DB も外部 API も持たない。

## 特徴

- 20 ステージの物理パズル(重力・斜面・反発・ばね・送風・てこ・振り子・滑車 …)
- Matter.js による 2D 物理演算
- Physics Lab — 重力・摩擦・反発・空気抵抗をスライダーで変えて観察する
- Replay — 操作ログを記録して再生する(動画は作らない)
- Physics Score と GOLD / SILVER / BRONZE
- レスポンシブ UI(PC / タブレット / スマートフォン)

## この実装で気をつけていること

**配るステージは、解けることを確かめてから配る。** 収録する全ステージは解答を同梱しており、
出荷するのと同じ物理エンジンで無頭実行して、制限時間内にゴールへ到達することを検査している
(SPEC の G-01)。ただしこれは片側の保証で、「解けない」と言うことはできない。

**物理は固定タイムステップで回す。** `Matter.Runner` の可変 delta では同じ操作が同じ結果に
ならず、Replay もスコアも再現しない。そのため 1000/60 ms 固定で `Engine.update` を回している
(SPEC の D-01)。再現性の主張は同一 JS エンジン内に限る —— `Math.sin` / `Math.cos` は
実装依存なので、ブラウザをまたいだビット一致は主張しない(D-02)。

**重力プリセットは教育用の近似で、SI 単位のシミュレーションではない。** Moon 0.165 /
Mars 0.378 は地球を 1.0 とした相対値であり、Matter.js の内部単位に対する近似である
(原仕様 §18)。About ページにも明記している。

## 技術

- Next.js / React / TypeScript
- Matter.js(物理演算)
- HTML Canvas(描画)
- LocalStorage(進捗保存)
- Web Audio API(効果音の生成 — 音声ファイルは持たない)

## 開発

```
npm install
npm run dev
```

## 検査

```
npm test           # 単体テスト(vitest)
npm run test:e2e   # E2E テスト(Playwright)
npm run typecheck  # 型検査
npm run build      # 出荷ビルド
```

## ライセンス

MIT License © 2026 坂田哲朗

### Third-party libraries

| ライブラリ | ライセンス |
|---|---|
| [Matter.js](https://github.com/liabru/matter-js) | MIT |
| [Next.js](https://github.com/vercel/next.js) | MIT |
| [React](https://github.com/facebook/react) | MIT |

依存ライブラリのライセンス表記は `/license` ページにも掲載している。
