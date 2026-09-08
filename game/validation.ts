import { CANVAS_HEIGHT, CANVAS_WIDTH, VALIDATION_RANGES } from "@/lib/constants";
import { TOOL_KINDS } from "@/types/physics";
import type { PhysicsObjectDefinition } from "@/types/physics";
import type { Stage, StageValidationError, StageValidationResult } from "@/types/stage";

/**
 * ステージ定義の検証。原仕様 §55。
 *
 * **不正値を Matter.js へ直接渡さない**ための関門である。Matter.js は NaN や
 * 範囲外の値を渡されても例外を投げず、**黙って壊れた世界を作る** ——
 * ボールが消える、すり抜ける、無限に加速する。どれも「バグ」ではなく
 * 「そういう物理」として動いてしまうので、実行しても原因に辿り着けない。
 *
 * 設計:
 * - **最初の 1 件で止めない。** すべての誤りを集めて返す(直す側が何度も往復しないで済む)
 * - **1 つの誤りが 1 件の報告になる。** 波及して複数件にしない(検査器が
 *   「何でも弾く」ようになっていないことを陽性対照で確かめられるようにするため)
 * - 範囲は**閉区間**として扱う。境界を弾くと正当なステージが作れなくなる
 */

/** 有限の数か(NaN・Infinity・null・文字列を弾く)。 */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateStage(stage: Stage): StageValidationResult {
  const errors: StageValidationError[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });

  /** 閉区間の検査。値が数でなければ「数でない」を 1 件だけ出す。 */
  const inRange = (v: unknown, min: number, max: number, path: string, label: string) => {
    if (!isFiniteNumber(v)) {
      add(path, `${label} が有限の数ではない`);
      return;
    }
    if (v < min || v > max) {
      add(path, `${label} が範囲 ${min}〜${max} の外(${v})`);
    }
  };

  // ── 世界 ────────────────────────────────────────────────
  // 原仕様 §55 は「gravity 0〜5」とだけ書いており、成分の符号を定めていない。
  // 横風(原仕様 §16 Stage 16)は左右どちらにも吹きうるので、
  // **成分の大きさ**が 5 を超えないことを検査する(SPEC D-08)。
  const g = VALIDATION_RANGES.gravity;
  inRange(stage.world?.gravityX, -g.max, g.max, "world.gravityX", "重力の x 成分");
  inRange(stage.world?.gravityY, -g.max, g.max, "world.gravityY", "重力の y 成分");

  // ── ボール ──────────────────────────────────────────────
  // 位置は**中心**で見る(原仕様 §55 の「x: 0〜CanvasWidth」をそのまま読む)。
  inRange(stage.ball?.x, 0, CANVAS_WIDTH, "ball.x", "ボールの x 座標");
  inRange(stage.ball?.y, 0, CANVAS_HEIGHT, "ball.y", "ボールの y 座標");

  if (!isFiniteNumber(stage.ball?.radius) || stage.ball.radius <= 0) {
    add("ball.radius", "ボールの半径が正の数でない");
  }

  const f = VALIDATION_RANGES.friction;
  const r = VALIDATION_RANGES.restitution;
  if (stage.ball?.friction !== undefined) {
    inRange(stage.ball.friction, f.min, f.max, "ball.friction", "ボールの摩擦");
  }
  if (stage.ball?.restitution !== undefined) {
    inRange(stage.ball.restitution, r.min, r.max, "ball.restitution", "ボールの反発");
  }

  // ── ゴール ──────────────────────────────────────────────
  // ゴールは矩形なので**外形**で見る。はみ出したゴールは届かない場所ができる。
  const goal = stage.goal;
  if (
    !isFiniteNumber(goal?.x) ||
    !isFiniteNumber(goal?.y) ||
    !isFiniteNumber(goal?.width) ||
    !isFiniteNumber(goal?.height) ||
    goal.width <= 0 ||
    goal.height <= 0
  ) {
    add("goal", "ゴールの座標か寸法が正の有限の数でない");
  } else if (
    goal.x - goal.width / 2 < 0 ||
    goal.x + goal.width / 2 > CANVAS_WIDTH ||
    goal.y - goal.height / 2 < 0 ||
    goal.y + goal.height / 2 > CANVAS_HEIGHT
  ) {
    add("goal", "ゴールがキャンバスからはみ出している");
  }

  // ── 制限時間 ────────────────────────────────────────────
  if (!isFiniteNumber(stage.timeLimit) || stage.timeLimit <= 0) {
    add("timeLimit", "制限時間が正の数でない");
  }

  // ── ツール ──────────────────────────────────────────────
  for (const kind of TOOL_KINDS) {
    const n = stage.tools?.[kind];
    if (!isFiniteNumber(n) || n < 0 || !Number.isInteger(n)) {
      add(`tools.${kind}`, `${kind} の個数が 0 以上の整数でない`);
    }
  }

  // ── ランクしきい値 ──────────────────────────────────────
  const s = stage.score;
  if (!isFiniteNumber(s?.gold) || !isFiniteNumber(s?.silver) || !isFiniteNumber(s?.bronze)) {
    add("score", "ランクしきい値が有限の数でない");
  } else if (!(s.gold > s.silver && s.silver > s.bronze && s.bronze >= 0)) {
    add("score", `ランクしきい値の順序が壊れている(gold ${s.gold} > silver ${s.silver} > bronze ${s.bronze} >= 0 でない)`);
  }

  // ── 追加のボール(原仕様 §22 Stage 17)────────────────────
  const extras = stage.extraBalls ?? [];
  extras.forEach((b, i) => {
    const at = `extraBalls[${i}]`;
    inRange(b?.x, 0, CANVAS_WIDTH, `${at}.x`, "追加ボールの x 座標");
    inRange(b?.y, 0, CANVAS_HEIGHT, `${at}.y`, "追加ボールの y 座標");

    if (!isFiniteNumber(b?.radius) || b.radius <= 0) {
      add(`${at}.radius`, "追加ボールの半径が正の数でない");
    }
    if (b?.friction !== undefined) {
      inRange(b.friction, f.min, f.max, `${at}.friction`, "追加ボールの摩擦");
    }
    if (b?.restitution !== undefined) {
      inRange(b.restitution, r.min, r.max, `${at}.restitution`, "追加ボールの反発");
    }
  });

  // ── 固定物 ──────────────────────────────────────────────
  // 拘束・規定運動が指せる先: 主ボール / 追加ボール / ゴール / 固定物の id。
  const seenIds = new Set<string>(["ball", "goal"]);
  extras.forEach((_, i) => seenIds.add(`ball-${i + 2}`));

  const objects = stage.fixedObjects ?? [];

  objects.forEach((def, i) => {
    const at = `fixedObjects[${i}]`;

    if (!def?.id || typeof def.id !== "string") {
      add(`${at}.id`, "id が文字列でない");
    } else if (seenIds.has(def.id)) {
      add(`${at}.id`, `id "${def.id}" が重複している`);
    } else {
      seenIds.add(def.id);
    }

    validateObject(def, at, { add, inRange, isFiniteNumber });
  });

  // 参照(ばね・リンク・規定運動)は、全 id が揃ってから確かめる(前方参照を許すため)。
  objects.forEach((def, i) => {
    const at = `fixedObjects[${i}]`;

    if (def?.kind === "spring" && !seenIds.has(def.objectId)) {
      add(`${at}.objectId`, `ばねの接続先 "${def.objectId}" が存在しない`);
    }

    if (def?.kind === "link") {
      if (!seenIds.has(def.bodyA)) add(`${at}.bodyA`, `リンクの接続先 "${def.bodyA}" が存在しない`);
      if (!seenIds.has(def.bodyB)) add(`${at}.bodyB`, `リンクの接続先 "${def.bodyB}" が存在しない`);
    }

    if (def?.kind === "mover" && !seenIds.has(def.target)) {
      add(`${at}.target`, `規定運動の対象 "${def.target}" が存在しない`);
    }
  });

  return { ok: errors.length === 0, errors };
}

type Helpers = {
  add: (path: string, message: string) => void;
  inRange: (v: unknown, min: number, max: number, path: string, label: string) => void;
  isFiniteNumber: (v: unknown) => v is number;
};

/** 種別ごとの検査。 */
function validateObject(def: PhysicsObjectDefinition, at: string, h: Helpers): void {
  const f = VALIDATION_RANGES.friction;
  const r = VALIDATION_RANGES.restitution;

  const positionInCanvas = (x: unknown, y: unknown) => {
    h.inRange(x, 0, CANVAS_WIDTH, `${at}.x`, "x 座標");
    h.inRange(y, 0, CANVAS_HEIGHT, `${at}.y`, "y 座標");
  };

  const positiveSize = (w: unknown, hh: unknown) => {
    if (!h.isFiniteNumber(w) || w <= 0) h.add(`${at}.width`, "幅が正の数でない");
    if (!h.isFiniteNumber(hh) || hh <= 0) h.add(`${at}.height`, "高さが正の数でない");
  };

  switch (def?.kind) {
    case "board":
      positionInCanvas(def.x, def.y);
      positiveSize(def.width, def.height);
      if (!h.isFiniteNumber(def.angle)) h.add(`${at}.angle`, "角度が有限の数でない");
      break;

    case "block":
      positionInCanvas(def.x, def.y);
      positiveSize(def.width, def.height);
      h.inRange(def.friction, f.min, f.max, `${at}.friction`, "摩擦");
      h.inRange(def.restitution, r.min, r.max, `${at}.restitution`, "反発");
      if (!h.isFiniteNumber(def.density) || def.density <= 0) {
        h.add(`${at}.density`, "密度が正の数でない");
      }
      break;

    case "spring":
      positionInCanvas(def.anchorX, def.anchorY);
      if (!h.isFiniteNumber(def.length) || def.length < 0) {
        h.add(`${at}.length`, "自然長が 0 以上の数でない");
      }
      h.inRange(def.stiffness, 0, 1, `${at}.stiffness`, "ばね定数");
      h.inRange(def.damping, 0, 1, `${at}.damping`, "減衰");
      break;

    case "fan":
      positionInCanvas(def.x, def.y);
      if (!h.isFiniteNumber(def.direction)) h.add(`${at}.direction`, "向きが有限の数でない");
      if (!h.isFiniteNumber(def.power)) h.add(`${at}.power`, "強さが有限の数でない");
      if (!h.isFiniteNumber(def.range) || def.range < 0) {
        h.add(`${at}.range`, "範囲が 0 以上の数でない");
      }
      break;

    case "mover":
      // 対象の存在は全 id が揃ってから確かめる(呼ぶ側)。ここでは形だけ見る。
      if (!["oscillateX", "oscillateY", "rotate"].includes(def.motion)) {
        h.add(`${at}.motion`, `未知の運動 "${def.motion}"`);
      }
      // 周期が 0 以下だと 0 除算になる。運動が定義できないので必ず正の数を要求する。
      if (!h.isFiniteNumber(def.periodTicks) || def.periodTicks <= 0) {
        h.add(`${at}.periodTicks`, "周期が正の数でない");
      }
      // 振幅は振動でのみ使う。負の振幅は位相を半周ずらしただけの重複表現なので禁じる。
      if (def.motion !== "rotate") {
        if (!h.isFiniteNumber(def.amplitude) || def.amplitude < 0) {
          h.add(`${at}.amplitude`, "振幅が 0 以上の数でない");
        }
      }
      if (def.phase !== undefined) {
        h.inRange(def.phase, 0, 1, `${at}.phase`, "位相");
      }
      break;

    case "link":
      // 接続先の存在は全 id が揃ってから確かめる(呼ぶ側)。
      if (!h.isFiniteNumber(def.length) || def.length < 0) {
        h.add(`${at}.length`, "自然長が 0 以上の数でない");
      }
      h.inRange(def.stiffness, 0, 1, `${at}.stiffness`, "ばね定数");
      if (def.damping !== undefined) {
        h.inRange(def.damping, 0, 1, `${at}.damping`, "減衰");
      }
      break;

    default:
      h.add(`${at}.kind`, `未知の種別 "${(def as { kind?: string })?.kind}"`);
  }
}
