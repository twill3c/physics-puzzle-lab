import { describe, it, expect } from "vitest";

import { validateStage } from "@/game/validation";
import { makeStage, boardAt } from "../helpers/stage";
import type { Stage } from "@/types/stage";

/**
 * G-05 — ステージ JSON の検証。原仕様 §55。
 *
 * **検査は対象に当てる前に、まず正常系へ当てて誤検出 0 を確かめる**(HC-074)。
 * 誤検出のある検査器は、正しいステージを弾いて「データが悪い」と言うので、
 * 原因が検査器にあることに気づきにくい。だから陰性対照を先に置く。
 *
 * 期待値の出所: 原仕様 §55(x/y は 0〜Canvas、friction/restitution は 0〜1、gravity は 0〜5)
 * および SPEC.md D-08(成分の符号の解釈)。
 */

/** 不正値を一箇所だけ入れるための、浅いコピーつき改変。 */
function withBall(stage: Stage, patch: Partial<Stage["ball"]>): Stage {
  return { ...stage, ball: { ...stage.ball, ...patch } };
}

describe("T-021 正常なステージを弾かない — 陰性対照(G-05)", () => {
  it("合成した正常ステージが通る", () => {
    const result = validateStage(makeStage());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("固定物・配置・ばね・送風を含む正常ステージが通る", () => {
    const stage = makeStage({
      fixedObjects: [
        boardAt("b1", 300, 300, 200, 20, 0.2),
        { id: "k1", kind: "block", x: 400, y: 100, width: 40, height: 40, density: 0.001, friction: 0.3, restitution: 0.4 },
        { id: "s1", kind: "spring", anchorX: 200, anchorY: 100, objectId: "ball", length: 80, stiffness: 0.05, damping: 0.02 },
        { id: "f1", kind: "fan", x: 500, y: 200, direction: Math.PI, power: 0.002, range: 150 },
      ],
      tools: { board: 2, block: 1, spring: 0, fan: 1 },
    });

    const result = validateStage(stage);
    expect(result.errors).toEqual([]);
  });

  it("境界値ちょうどは通る(0 と 1、gravity 5)", () => {
    // 範囲は閉区間として扱う。境界を弾くと、正当なステージが作れなくなる。
    const stage = makeStage({
      world: { gravityX: 0, gravityY: 5 },
      ball: { x: 0, y: 0, radius: 14, density: 0.001, friction: 0, restitution: 1 },
    });
    expect(validateStage(stage).errors).toEqual([]);
  });
});

describe("T-022 不正値を弾く(G-05)", () => {
  const cases: { name: string; stage: Stage; path: string }[] = [
    {
      name: "ball.x がキャンバス右外",
      stage: withBall(makeStage(), { x: 901 }),
      path: "ball.x",
    },
    {
      name: "ball.y がキャンバス下外",
      stage: withBall(makeStage(), { y: 541 }),
      path: "ball.y",
    },
    {
      name: "ball.x が負",
      stage: withBall(makeStage(), { x: -1 }),
      path: "ball.x",
    },
    {
      name: "friction が 1 を超える",
      stage: withBall(makeStage(), { friction: 1.01 }),
      path: "ball.friction",
    },
    {
      name: "restitution が負",
      stage: withBall(makeStage(), { restitution: -0.01 }),
      path: "ball.restitution",
    },
    {
      name: "gravityY が 5 を超える",
      stage: makeStage({ world: { gravityX: 0, gravityY: 5.1 } }),
      path: "world.gravityY",
    },
    {
      name: "半径が 0 以下",
      stage: withBall(makeStage(), { radius: 0 }),
      path: "ball.radius",
    },
    {
      name: "timeLimit が 0",
      stage: makeStage({ timeLimit: 0 }),
      path: "timeLimit",
    },
    {
      name: "ツールの個数が負",
      stage: makeStage({ tools: { board: -1, block: 0, spring: 0, fan: 0 } }),
      path: "tools.board",
    },
    {
      name: "ランクしきい値の順序が壊れている",
      stage: makeStage({ score: { gold: 500, silver: 700, bronze: 400 } }),
      path: "score",
    },
    {
      name: "固定物の id が重複している",
      stage: makeStage({
        fixedObjects: [boardAt("dup", 300, 300), boardAt("dup", 400, 400)],
      }),
      path: "fixedObjects[1].id",
    },
    {
      name: "ばねの接続先が存在しない",
      stage: makeStage({
        fixedObjects: [
          { id: "s1", kind: "spring", anchorX: 200, anchorY: 100, objectId: "いない", length: 80, stiffness: 0.05, damping: 0 },
        ],
      }),
      path: "fixedObjects[0].objectId",
    },
    {
      name: "ゴールがキャンバスからはみ出している",
      stage: makeStage({ goal: { x: 890, y: 300, width: 60, height: 60 } }),
      path: "goal",
    },
    {
      name: "送風の range が負",
      stage: makeStage({
        fixedObjects: [
          { id: "f1", kind: "fan", x: 400, y: 200, direction: 0, power: 0.002, range: -1 },
        ],
      }),
      path: "fixedObjects[0].range",
    },
  ];

  for (const c of cases) {
    it(`${c.name} を弾く`, () => {
      const result = validateStage(c.stage);
      expect(result.ok).toBe(false);
      expect(result.errors.map((e) => e.path)).toContain(c.path);
    });
  }

  it("走査対象が空でない(検査が空振りしていない)", () => {
    expect(cases.length).toBeGreaterThan(10);
  });
});

describe("T-023 検証器そのものの検査 — 陽性対照(G-05)", () => {
  it("不正値を 1 箇所だけ入れたとき、報告されるのはその 1 箇所である", () => {
    // 検査器が「何でも弾く」ようになっていないことを確かめる。
    // 全部弾く検査器は T-022 を全件通してしまい、緑のまま無意味になる。
    const result = validateStage(withBall(makeStage(), { friction: 2 }));

    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe("ball.friction");
  });

  it("複数の不正値はすべて報告される(最初の 1 件で止まらない)", () => {
    const stage = withBall(makeStage({ timeLimit: -5 }), { friction: 2, restitution: 9 });
    const paths = validateStage(stage).errors.map((e) => e.path);

    expect(paths).toContain("ball.friction");
    expect(paths).toContain("ball.restitution");
    expect(paths).toContain("timeLimit");
  });
});
