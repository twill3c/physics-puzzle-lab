import Matter from "matter-js";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import type { Simulation } from "@/physics/world";
import type { Stage } from "@/types/stage";

/**
 * 描画モデル。**「何をどこに描くか」を純関数で出す。**
 *
 * Canvas 呼び出しをここから分けておく理由は二つある。
 *
 * 1. 描画の正しさを目視以外で確かめられる。位置・大きさ・数を単体検査できる
 * 2. **図の中の値が、図を生成したのと同じデータから導かれる**(HC-045)。
 *    描画側が独自に位置を計算し始めると、物理と図がずれても誰も気づかない
 *
 * 形は角度ではなく**頂点**で持つ。角度と頂点の両方を持つと、片方だけ更新された
 * ときに図が嘘をつく。matter-js の Body は変形済みの頂点を持っているので、
 * それをそのまま使う。
 */

export type ShapeRole = "ball" | "goal" | "fixed" | "placed";

export interface RenderShape {
  id: string;
  role: ShapeRole;
  kind: "circle" | "polygon";
  /** 中心座標(論理座標)。 */
  x: number;
  y: number;
  /** 円のとき。 */
  radius?: number;
  /** 多角形のとき。すでに回転・移動が適用された頂点。 */
  vertices?: { x: number; y: number }[];
  /**
   * 状態の強調。**色以外にも状態が出るように**、描画側は縁取りや印でも表す
   * (SPEC N-06: 色だけで状態を表さない)。
   */
  active: boolean;
}

export interface RenderModel {
  width: number;
  height: number;
  shapes: RenderShape[];
  /** ゴール滞在の進み具合(0〜1)。滞在の手応えを色以外で見せるために使う。 */
  goalProgress: number;
}

/** 外枠は画面の外にあるので描かない。 */
function isWall(label: string): boolean {
  return label.startsWith("wall-");
}

/**
 * いまの世界から描画モデルを作る。
 *
 * `placedIds` は「プレイヤーが置いた物」の id。掴めるのはこれだけなので、
 * 役割を分けておく(hitTest が使う)。
 */
export function buildRenderModel(sim: Simulation, stage: Stage, placedIds?: Set<string>): RenderModel {
  const fixedIds = new Set(stage.fixedObjects.map((o) => o.id));
  const shapes: RenderShape[] = [];

  const dwellRatio = Math.min(1, sim.goalDwellTicks / 18);

  for (const body of Matter.Composite.allBodies(sim.engine.world)) {
    const label = body.label;
    if (isWall(label)) continue;

    const role: ShapeRole =
      label === "ball" || label.startsWith("ball-")
        ? "ball"
        : label === "goal"
          ? "goal"
          : placedIds
            ? placedIds.has(label)
              ? "placed"
              : "fixed"
            : fixedIds.has(label)
              ? "fixed"
              : "placed";

    const shape: RenderShape = {
      id: label,
      role,
      kind: body.circleRadius ? "circle" : "polygon",
      x: body.position.x,
      y: body.position.y,
      active: role === "goal" ? sim.goalDwellTicks > 0 : false,
    };

    if (body.circleRadius) {
      shape.radius = body.circleRadius;
    } else {
      shape.vertices = body.vertices.map((v) => ({ x: v.x, y: v.y }));
    }

    shapes.push(shape);
  }

  return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, shapes, goalProgress: dwellRatio };
}

/** 表示倍率。原仕様 §43(レスポンシブ)。 */
export interface CanvasFit {
  scale: number;
  cssWidth: number;
  cssHeight: number;
}

/**
 * 与えられた表示幅に論理キャンバスを収める。
 *
 * 拡大には上限を置く。青天井に拡大しても情報は増えず、
 * 線と当たり判定が粗く見えるだけである。
 */
export function fitCanvas(cssWidth: number, maxScale = 2): CanvasFit {
  const scale = Math.min(cssWidth / CANVAS_WIDTH, maxScale);
  return { scale, cssWidth: CANVAS_WIDTH * scale, cssHeight: CANVAS_HEIGHT * scale };
}

/** 画面座標 → 論理座標。掴んだ場所と置かれる場所をずらさないための変換。 */
export function screenToLogical(x: number, y: number, scale: number): { x: number; y: number } {
  return { x: x / scale, y: y / scale };
}

/** 論理座標 → 画面座標。 */
export function logicalToScreen(x: number, y: number, scale: number): { x: number; y: number } {
  return { x: x * scale, y: y * scale };
}

/** 点が多角形の内側にあるか(交差数判定)。 */
function pointInPolygon(px: number, py: number, vs: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x;
    const yi = vs[i].y;
    const xj = vs[j].x;
    const yj = vs[j].y;
    const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/**
 * 掴み判定。動かせるのは**プレイヤーが置いた部品だけ**。
 *
 * 重なっているときは**後から置いたもの**を返す。画面の手前にある物が掴めないと、
 * 利用者は「反応しない」と受け取る。
 */
export function hitTest(model: RenderModel, x: number, y: number): string | null {
  for (let i = model.shapes.length - 1; i >= 0; i--) {
    const s = model.shapes[i];
    if (s.role !== "placed") continue;

    if (s.kind === "circle" && s.radius !== undefined) {
      if (Math.hypot(x - s.x, y - s.y) <= s.radius) return s.id;
    } else if (s.vertices && pointInPolygon(x, y, s.vertices)) {
      return s.id;
    }
  }
  return null;
}
