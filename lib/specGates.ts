/**
 * SPEC の品質ゲート表と TEST_SPEC のケース表の対応を機械で数える。
 *
 * 出所: SPEC.md §6 の G-00。
 *
 * なぜこれが要るか —— テストは自分が書いた分しか主張せず、**書き忘れたゲートについては
 * 沈黙する**。`G-xx` を SPEC に書いた時点で「守られている」と錯覚しやすく、しかもその
 * 錯覚を壊す仕掛けが無い。だから対応そのものを検査する。
 *
 * この検査は「ゲートが正しく実装されている」ことは何も言わない。
 * 言うのは「ゲートに対応するケースが存在するか、存在しないと明記されているか」だけである。
 */

/** SPEC の品質ゲート表から読み取った 1 行。 */
export interface SpecGate {
  id: string;
  /** 状態欄に「未実装」と書かれているか。書かれていれば被覆の免除対象。 */
  acknowledgedUnimplemented: boolean;
}

export interface GateCoverageViolations {
  /** 参照も未実装表記も無いゲート。宣言しただけで誰も守っていない。 */
  uncovered: string[];
  /** TEST_SPEC が参照しているが SPEC に存在しないゲート。多くは誤記。 */
  dangling: string[];
}

const GATE_ID = /\bG-\d+\b/g;

/** Markdown の表の行を、先頭・末尾のパイプを落としてセルへ割る。 */
function splitRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
  return cells.length >= 2 ? cells : null;
}

/** 区切り行(`|---|---|`)か。 */
function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/**
 * SPEC 本文から品質ゲートの一覧を読む。
 *
 * 拾うのは「1 列目が `G-xx` だけの表の行」。本文中で `G-01` に言及しただけの文は
 * ゲートの宣言ではないので拾わない —— 拾ってしまうと、言及するたびに
 * 被覆義務が生える。
 */
export function parseSpecGates(specText: string): SpecGate[] {
  const gates: SpecGate[] = [];
  const seen = new Set<string>();

  for (const line of specText.split(/\r?\n/)) {
    const cells = splitRow(line);
    if (!cells || isSeparatorRow(cells)) continue;

    const id = cells[0];
    if (!/^G-\d+$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    // 状態欄は最終列に置く規約(SPEC §6)。列が増えても末尾を見れば足りるが、
    // 取り違えを避けるため「行のどこかに未実装とある」で判定する。
    // ゲート名に「未実装」を含めることは無い(含めたくなったら状態欄に書く)。
    const acknowledgedUnimplemented = cells.slice(1).some((c) => c.includes("未実装"));

    gates.push({ id, acknowledgedUnimplemented });
  }

  return gates;
}

/**
 * TEST_SPEC 本文から、ケースが参照しているゲート ID を集める。
 *
 * 拾うのは「1 列目が `T-xxx` の表の行の、2 列目(対応要求)」。
 * 見出しや散文での言及は拾わない —— ケース表に書かれていることを要求するのが
 * この検査の趣旨だからである。
 */
export function parseTestSpecRefs(testSpecText: string): Set<string> {
  const refs = new Set<string>();

  for (const line of testSpecText.split(/\r?\n/)) {
    const cells = splitRow(line);
    if (!cells || isSeparatorRow(cells)) continue;

    if (!/^T-\d+$/.test(cells[0])) continue;

    for (const match of cells[1].matchAll(GATE_ID)) {
      refs.add(match[0]);
    }
  }

  return refs;
}

/** ゲート表と参照集合を突き合わせる。 */
export function findGateCoverageViolations(
  gates: SpecGate[],
  refs: Set<string>,
): GateCoverageViolations {
  const known = new Set(gates.map((g) => g.id));

  const uncovered = gates
    .filter((g) => !g.acknowledgedUnimplemented && !refs.has(g.id))
    .map((g) => g.id);

  const dangling = [...refs].filter((id) => !known.has(id)).sort();

  return { uncovered, dangling };
}
