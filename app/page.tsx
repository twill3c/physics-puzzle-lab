import Link from "next/link";

/** ホーム画面のメニュー(原仕様 §40)。 */
const MENU = [
  {
    href: "/game",
    label: "PLAY",
    desc: "20 ステージの物理パズル。部品を置いてボールをゴールへ導く。",
    primary: true,
  },
  {
    href: "/lab",
    label: "PHYSICS LAB",
    desc: "重力・摩擦・反発・空気抵抗を動かして、その場で観察する実験室。",
    primary: false,
  },
  {
    href: "/stages",
    label: "STAGES",
    desc: "ステージ一覧と成績。クリアすると次が開く。",
    primary: false,
  },
  {
    href: "/how-to-play",
    label: "HOW TO PLAY",
    desc: "操作方法、部品の性質、スコアの決まり方。",
    primary: false,
  },
  {
    href: "/about",
    label: "ABOUT",
    desc: "このアプリが何を測り、何を測っていないか。",
    primary: false,
  },
];

export default function HomePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <h1 className="hero__title">
          PHYSICS
          <br />
          PUZZLE
          <br />
          LAB
        </h1>
        <p className="hero__tagline">物理で遊ぶ。実験して理解する。</p>
      </section>

      <nav aria-label="メインメニュー">
        <ul className="menu">
          {MENU.map((item) => (
            <li className="menu__item" key={item.href}>
              <Link
                className={`menu__link${item.primary ? " menu__link--primary" : ""}`}
                href={item.href}
              >
                <span className="menu__label">{item.label}</span>
                <span className="menu__desc">{item.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
