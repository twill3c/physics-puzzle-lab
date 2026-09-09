import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Physics Puzzle Lab",
  description:
    "このアプリが何を測り、何を測っていないか。重力プリセットは教育用の近似であって SI 単位のシミュレーションではない。",
};

export default function AboutPage() {
  return (
    <main className="wrap prose">
      <h1>About</h1>
      <p className="sub">このアプリが何を測り、何を測っていないか。</p>

      <h2>これは何か</h2>
      <p>
        2D 物理シミュレーションの上でボールをゴールへ導くパズルと、重力・摩擦・反発を
        自由に動かせる実験室です。すべてブラウザの中で動き、サーバも DB も外部 API も
        持ちません。遊んだ記録はこのブラウザの中にだけ残ります。
      </p>

      <h2>重力の数値は SI 単位ではない</h2>
      <p>
        Lab の <strong>Earth 1.0 / Moon 0.165 / Mars 0.378</strong> は、地球を 1.0 とした
        <strong>相対値</strong>です。これを物理エンジンの内部単位へそのまま与えています。
        月の重力が地球のおよそ 1/6 であるという<strong>比</strong>は現実に沿っていますが、
        画面に出る「9.8 m/s²」のような量ではありません。
      </p>
      <p>
        同じ理由で、状態量の単位は <code>px/tick</code>(1 tick = 1/60 秒)であって
        m/s ではありません。<strong>教育用の近似</strong>として作ってあります。
      </p>

      <h2>配る面は、解けることを確かめてから配っている</h2>
      <p>
        収録している 20 面はすべて、<strong>出荷するのと同じ物理エンジン</strong>で
        解答を実行し、制限時間内にゴールへ到達することを検査してから収録しています。
        「解けない面が混じっている」ことは起きません。
      </p>
      <p>
        ただしこの保証は<strong>片側だけ</strong>です。「この面は解ける」とは言えますが、
        「この置き方では解けない」とは言えません。あなたの見つけた解が
        こちらの用意した解と違っても、それは正解です。道は一つではありません。
      </p>

      <h2>同じ操作は同じ結果になる</h2>
      <p>
        物理は実時間ではなく<strong>固定の刻み</strong>(1/60 秒)で進みます。
        そのため、同じ場所に同じ角度で部品を置けば、何度やっても同じ軌跡になります。
        Slow Motion で速さを変えても、物理の刻みは変わりません —— 変わるのは
        「1 コマで何回進めるか」だけなので、ゆっくり見ても結果は同じです。
      </p>
      <p className="muted">
        この再現性は<strong>同じブラウザの中</strong>での話です。
        <code>Math.sin</code> のような関数の最下位の桁はブラウザによって違うことがあるので、
        別のブラウザで完全に同じ数になることまでは保証していません。
      </p>

      <h2>保存するもの</h2>
      <p>
        ブラウザの LocalStorage に、<strong>どこまで進んだか・各面のベストスコア・
        音の設定</strong>だけを保存します。個人を特定できるものは保存しません。
        送信先もありません。ブラウザのデータを消せば進捗も消えます。
      </p>

      <h2>技術</h2>
      <ul>
        <li>Next.js / React / TypeScript</li>
        <li>Matter.js(物理演算)</li>
        <li>HTML Canvas(描画)</li>
        <li>Web Audio API(効果音の生成 — 音声ファイルは持ちません)</li>
      </ul>

      <p className="muted">
        <Link href="/">← ホームへ</Link> ・ <Link href="/license">ライセンス</Link>
      </p>
    </main>
  );
}
