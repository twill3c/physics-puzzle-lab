import type { RenderModel, RenderShape } from "./render";

/**
 * Canvas への描画。**描画モデルをなぞるだけ**にする。
 *
 * ここで位置を計算し直さない —— 図の中の値は、図を生成したのと同じデータから
 * 導くこと(HC-045)。計算は lib/render.ts で済んでいる。
 */

export interface DrawOptions {
  scale: number;
  /** 選択中の配置 id。縁取りを変えて示す。 */
  selectedId?: string | null;
  /** 動きを減らす設定(SPEC N-06)。真なら演出を出さない。 */
  reducedMotion?: boolean;
  particles?: Particle[];
}

const COLORS = {
  bg: "#0e1116",
  grid: "#1b2230",
  ball: "#ffd166",
  ballEdge: "#8a6d2f",
  fixed: "#5b6a80",
  goal: "#4fa3ff",
  placed: "#7ee0a4",
  selected: "#ffffff",
} as const;

/** 世界を 1 枚描く。 */
export function drawModel(
  ctx: CanvasRenderingContext2D,
  model: RenderModel,
  opts: DrawOptions,
): void {
  const { scale } = opts;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, model.width, model.height);

  drawGrid(ctx, model);

  // ゴール → 固定物 → 配置 → ボール の順に描く。
  // 後に描いたものが手前に来るので、掴める物とボールを見えやすくする。
  const order: RenderShape["role"][] = ["goal", "fixed", "placed", "ball"];
  for (const role of order) {
    for (const s of model.shapes) {
      if (s.role !== role) continue;
      drawShape(ctx, s, model, opts);
    }
  }

  if (!opts.reducedMotion && opts.particles) drawParticles(ctx, opts.particles);

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, model: RenderModel): void {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= model.width; x += 60) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, model.height);
  }
  for (let y = 0; y <= model.height; y += 60) {
    ctx.moveTo(0, y);
    ctx.lineTo(model.width, y);
  }
  ctx.stroke();
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  s: RenderShape,
  model: RenderModel,
  opts: DrawOptions,
): void {
  const selected = opts.selectedId === s.id;

  if (s.role === "goal") {
    drawGoal(ctx, s, model);
    return;
  }

  ctx.beginPath();
  if (s.kind === "circle" && s.radius !== undefined) {
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
  } else if (s.vertices) {
    ctx.moveTo(s.vertices[0].x, s.vertices[0].y);
    for (let i = 1; i < s.vertices.length; i++) ctx.lineTo(s.vertices[i].x, s.vertices[i].y);
    ctx.closePath();
  }

  ctx.fillStyle = s.role === "ball" ? COLORS.ball : s.role === "placed" ? COLORS.placed : COLORS.fixed;
  ctx.fill();

  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? COLORS.selected : s.role === "ball" ? COLORS.ballEdge : "#2b3340";
  ctx.stroke();

  // 選択中は縁取りに加えて角に印を出す —— 色だけで状態を表さない(SPEC N-06)。
  if (selected) drawSelectionMarks(ctx, s);
}

function drawSelectionMarks(ctx: CanvasRenderingContext2D, s: RenderShape): void {
  const pts = s.vertices ?? [];
  ctx.fillStyle = COLORS.selected;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * ゴール。滞在の進み具合を**枠の太さと目盛り**でも示す。
 *
 * 原仕様 §16 は 300 ms の滞在を求めるが、滞在中であることが見えないと
 * 「入ったのにクリアにならない」と受け取られる。色だけに頼らず、
 * 進み具合を弧で描く(SPEC N-06)。
 */
function drawGoal(ctx: CanvasRenderingContext2D, s: RenderShape, model: RenderModel): void {
  const vs = s.vertices;
  if (!vs) return;

  ctx.beginPath();
  ctx.moveTo(vs[0].x, vs[0].y);
  for (let i = 1; i < vs.length; i++) ctx.lineTo(vs[i].x, vs[i].y);
  ctx.closePath();

  ctx.fillStyle = "rgba(79,163,255,0.16)";
  ctx.fill();
  ctx.lineWidth = s.active ? 4 : 2;
  ctx.setLineDash(s.active ? [] : [8, 6]);
  ctx.strokeStyle = COLORS.goal;
  ctx.stroke();
  ctx.setLineDash([]);

  if (model.goalProgress > 0) {
    const r = 16;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * model.goalProgress);
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.goal;
    ctx.stroke();
  }
}

/** クリア演出の粒。原仕様 §42。Canvas で軽く済ませる。 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export function spawnParticles(x: number, y: number, n = 28): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const speed = 1.5 + (i % 5) * 0.4;
    out.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 1, life: 1 });
  }
  return out;
}

export function stepParticles(ps: Particle[]): Particle[] {
  return ps
    .map((p) => ({ x: p.x + p.vx, y: p.y + p.vy, vx: p.vx * 0.98, vy: p.vy * 0.98 + 0.12, life: p.life - 0.02 }))
    .filter((p) => p.life > 0);
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[]): void {
  for (const p of ps) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
