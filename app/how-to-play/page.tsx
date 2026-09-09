import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "遊び方 — Physics Puzzle Lab",
  description: "操作方法、部品の性質、スコアの決まり方。",
};

export default function HowToPlayPage() {
  return (
    <main className="wrap prose">
      <h1>遊び方</h1>
      <p className="sub">操作方法、部品の性質、スコアの決まり方。</p>

      <h2>目標</h2>
      <p>
        ボールをゴールへ導きます。ゴールは通り抜けられるので、
        <strong>入るだけでは足りません</strong> —— 0.3 秒(18 コマ)続けて
        留まるとクリアです。通り過ぎたときは、枠の中の弧が途中で止まります。
      </p>

      <h2>操作</h2>
      <table>
        <thead>
          <tr>
            <th>したいこと</th>
            <th>マウス / タッチ</th>
            <th>キーボード</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>部品を置く</td>
            <td>パレットで選び、空いている所を押す</td>
            <td>—</td>
          </tr>
          <tr>
            <td>動かす</td>
            <td>置いた部品をドラッグ</td>
            <td>—</td>
          </tr>
          <tr>
            <td>回す</td>
            <td>Shift を押しながらドラッグ</td>
            <td>—</td>
          </tr>
          <tr>
            <td>消す</td>
            <td>選んで Delete ボタン</td>
            <td><kbd>Delete</kbd></td>
          </tr>
          <tr>
            <td>開始 / 一時停止</td>
            <td>Start / Pause</td>
            <td><kbd>Space</kbd></td>
          </tr>
          <tr>
            <td>やり直す</td>
            <td>Reset</td>
            <td><kbd>R</kbd></td>
          </tr>
          <tr>
            <td>ゆっくり見る</td>
            <td>Slow</td>
            <td><kbd>S</kbd></td>
          </tr>
          <tr>
            <td>選択を外す</td>
            <td>何も無い所を押す</td>
            <td><kbd>Esc</kbd></td>
          </tr>
        </tbody>
      </table>

      <h2>部品</h2>
      <ul>
        <li>
          <strong>BOARD(板)</strong> — 傾けると坂になります。
          <strong>右下がり(正の角度)でボールは右へ</strong>進みます。
        </li>
        <li>
          <strong>BLOCK(箱)</strong> — 重さがあり、落ちて他の物を押します。
        </li>
        <li>
          <strong>SPRING(ばね)</strong> — 置いた場所を支点にしてボールを引き寄せます。
          上から吊れば持ち上がります。
        </li>
        <li>
          <strong>FAN(送風)</strong> — 決まった範囲に入った物へ、力を加え続けます。
        </li>
      </ul>

      <h2>スコア</h2>
      <p>1000 点から引いていきます。</p>
      <ul>
        <li>かかった時間 1 秒につき <strong>−5</strong></li>
        <li>置いた部品 1 個につき <strong>−20</strong></li>
        <li>やり直し 1 回につき <strong>−30</strong></li>
      </ul>
      <p>
        900 点以上で <strong>GOLD</strong>、700 点以上で <strong>SILVER</strong>、
        400 点以上で <strong>BRONZE</strong>、それ未満でも到達すれば <strong>CLEAR</strong> です。
        <strong>少ない部品で、早く、やり直さずに</strong>解くほど高くなります。
      </p>

      <h2>詰まったら</h2>
      <p>
        置く場所を数ピクセル変えるだけで結果は変わります。Slow で落ちていく様子を
        見ると、どこで逸れているかが分かります。それでも動かないときは、
        <Link href="/lab">Physics Lab</Link> で部品の性質そのものを触ってみてください。
      </p>

      <p className="muted">
        <Link href="/">← ホームへ</Link> ・ <Link href="/stages">ステージ一覧</Link>
      </p>
    </main>
  );
}
