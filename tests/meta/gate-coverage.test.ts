import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseSpecGates, parseTestSpecRefs, findGateCoverageViolations } from "@/lib/specGates";

const ROOT = path.resolve(__dirname, "..", "..");

function read(name: string): string {
  return readFileSync(path.join(ROOT, name), "utf8");
}

/**
 * T-001 / G-00 — SPEC の品質ゲート表と TEST_SPEC のケース表の対応を機械で数える。
 *
 * 期待値の出所: SPEC.md §6 の G-00。
 * 「G-xx を書いた時点で守られていると錯覚する」ことを防ぐための検査であって、
 * テストが自分で書いた分しか主張しないという性質そのものを埋める。
 */
describe("T-001 品質ゲートの被覆(G-00)", () => {
  it("SPEC の全ゲートが、TEST_SPEC から参照されるか SPEC 側で未実装と明記されている", () => {
    const spec = read("SPEC.md");
    const testSpec = read("TEST_SPEC.md");

    const gates = parseSpecGates(spec);
    const refs = parseTestSpecRefs(testSpec);

    // 走査対象が空でないことを別に確かめる(検査が空振りしていないこと)。
    expect(gates.length).toBeGreaterThan(0);
    expect(refs.size).toBeGreaterThan(0);

    const violations = findGateCoverageViolations(gates, refs);
    expect(violations.uncovered).toEqual([]);
  });

  it("TEST_SPEC が SPEC に存在しないゲートを参照していない", () => {
    const gates = parseSpecGates(read("SPEC.md"));
    const refs = parseTestSpecRefs(read("TEST_SPEC.md"));

    const violations = findGateCoverageViolations(gates, refs);
    expect(violations.dangling).toEqual([]);
  });
});

/**
 * T-002 / G-00 — T-001 の陽性対照。
 *
 * HC-041: 検出系のテストは、対象に違反が無いときと検査そのものが働いていないときとで、
 * まったく同じ緑を返す。だから「必ず捕まえるべき悪い例」と「撃ってはならない正当な例」を
 * 同じ場所に置き、パターン自身をテストする。
 */
describe("T-002 ゲート被覆検査そのものの検査(G-00)", () => {
  const specWith = (rows: string) => `## 6. 品質ゲート\n\n| ID | ゲート | 判定 | 状態 |\n|---|---|---|---|\n${rows}\n`;
  const testSpecWith = (rows: string) => `## ケース一覧\n\n| ID | 対応要求 | ケース | 期待 |\n|---|---|---|---|\n${rows}\n`;

  it("参照も未実装表記も無いゲートを捕まえる(捕まえるべき悪い例)", () => {
    const gates = parseSpecGates(specWith("| G-77 | 宣言だけのゲート | 落とす | 実装済み |"));
    const refs = parseTestSpecRefs(testSpecWith("| T-900 | F-01 | 無関係なケース | 通る |"));

    // 前提の固定: 対照が対照として成り立っていること(HC-079)。
    expect(gates.map((g) => g.id)).toContain("G-77");
    expect(refs.has("G-77")).toBe(false);

    expect(findGateCoverageViolations(gates, refs).uncovered).toEqual(["G-77"]);
  });

  it("未実装と明記されたゲートは撃たない(撃ってはならない正当な例)", () => {
    const gates = parseSpecGates(specWith("| G-78 | まだ作っていないゲート | 落とす | 未実装(L3) |"));
    const refs = parseTestSpecRefs(testSpecWith("| T-901 | F-01 | 無関係なケース | 通る |"));

    expect(gates.map((g) => g.id)).toContain("G-78");
    expect(findGateCoverageViolations(gates, refs).uncovered).toEqual([]);
  });

  it("TEST_SPEC から参照されたゲートは撃たない(撃ってはならない正当な例)", () => {
    const gates = parseSpecGates(specWith("| G-79 | 参照されているゲート | 落とす | 実装済み |"));
    const refs = parseTestSpecRefs(testSpecWith("| T-902 | F-02 / G-79 | 対応するケース | 通る |"));

    expect(refs.has("G-79")).toBe(true);
    expect(findGateCoverageViolations(gates, refs).uncovered).toEqual([]);
  });

  it("実ブラウザのケース(E-xx)からの参照も数える", () => {
    // 実ブラウザ検品も同じくゲートを担う。ここを数え落とすと、
    // E2E でしか確かめられないゲート(G-14 など)が「参照なし」に見える。
    const gates = parseSpecGates(specWith("| G-81 | 実ブラウザで見るゲート | 落とす | 実装済み |"));
    const refs = parseTestSpecRefs(testSpecWith("| E-06 | F-27 / G-81 | 幅を変えて測る | 溢れない |"));

    expect(refs.has("G-81")).toBe(true);
    expect(findGateCoverageViolations(gates, refs).uncovered).toEqual([]);
  });

  it("SPEC に無いゲートへの参照を dangling として捕まえる", () => {
    const gates = parseSpecGates(specWith("| G-80 | 実在するゲート | 落とす | 実装済み |"));
    const refs = parseTestSpecRefs(testSpecWith("| T-903 | G-80 / G-99 | 誤記を含むケース | 通る |"));

    expect(findGateCoverageViolations(gates, refs).dangling).toEqual(["G-99"]);
  });
});
