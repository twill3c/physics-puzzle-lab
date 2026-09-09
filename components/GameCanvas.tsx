"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buildRenderModel, fitCanvas, hitTest, screenToLogical } from "@/lib/render";
import { drawModel, spawnParticles, stepParticles, type Particle } from "@/lib/draw";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/constants";
import type { Game } from "@/game/gameManager";
import type { ToolKind } from "@/types/physics";
import { Simulation } from "@/physics/world";

interface Props {
  game: Game;
  activeTool: ToolKind | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 編集で状態が変わったことを親へ知らせる(残数・スコアの表示更新)。 */
  onChange: () => void;
  reducedMotion: boolean;
}

/**
 * ゲーム画面の Canvas。
 *
 * **React の再描画と物理の更新を分ける**(原仕様 §47)。物理と描画は
 * `requestAnimationFrame` の中で回し、React の state は「選択が変わった」
 * 「決着した」といった節目でしか触らない。毎 tick state を更新すると、
 * 60 FPS で React の再描画が走って追いつかなくなる。
 */
export default function GameCanvas({
  game,
  activeTool,
  selectedId,
  onSelect,
  onChange,
  reducedMotion,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // rAF の中から読むものは ref に置く。state にすると毎フレーム再描画になる。
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const rotateRef = useRef<{ id: string } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastStatusRef = useRef(game.status);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  // 表示幅に合わせて論理キャンバスを収める(原仕様 §43)。
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const apply = () => setScale(fitCanvas(el.clientWidth).scale);
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 物理と描画のループ。
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);

      const elapsed = now - prev;
      prev = now;

      // 実時間から「進めるフレーム数」を出し、Slow Motion はそこに掛ける。
      // 物理の刻みは常に 1000/60 ms のまま(SPEC D-01 / D-07)。
      const frames = Math.min(4, Math.max(0, Math.round(elapsed / (1000 / 60))));
      const ticks = game.ticksForFrame(frames);
      if (ticks > 0) game.advance(ticks);

      if (game.status !== lastStatusRef.current) {
        lastStatusRef.current = game.status;
        if (game.status === "CLEAR" && !reducedMotion) {
          const b = game.ballState();
          particlesRef.current = spawnParticles(b.x, b.y);
        }
        onChange();
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      // 走っていないあいだも盤面は見せる。配置だけの世界を組んで描く。
      const sim = game.simulation() ?? new Simulation({ stage: game.stage, placements: game.placements });
      const placedIds = new Set(game.placements.map((p) => p.id));
      const model = buildRenderModel(sim, game.stage, placedIds);

      particlesRef.current = stepParticles(particlesRef.current);

      drawModel(ctx, model, {
        scale,
        selectedId: selectedRef.current,
        reducedMotion,
        particles: particlesRef.current,
      });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, scale, reducedMotion, onChange]);

  const logicalFromEvent = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return screenToLogical(e.clientX - rect.left, e.clientY - rect.top, scale);
    },
    [scale],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (game.status === "RUNNING" || game.status === "PAUSED") return;

      const pt = logicalFromEvent(e);
      const sim = game.simulation() ?? new Simulation({ stage: game.stage, placements: game.placements });
      const placedIds = new Set(game.placements.map((p) => p.id));
      const model = buildRenderModel(sim, game.stage, placedIds);

      const hit = hitTest(model, pt.x, pt.y);

      if (hit) {
        const p = game.placements.find((q) => q.id === hit)!;
        e.currentTarget.setPointerCapture(e.pointerId);

        // 選択中の部品をもう一度掴んだら回転、そうでなければ移動。
        if (selectedRef.current === hit && e.shiftKey) {
          rotateRef.current = { id: hit };
        } else {
          dragRef.current = { id: hit, dx: pt.x - p.x, dy: pt.y - p.y };
        }
        onSelect(hit);
        return;
      }

      // 何も無い所を指したら、選んでいる道具を置く。
      if (activeTool && game.canPlace(activeTool)) {
        const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
        game.place(id, activeTool, pt.x, pt.y, 0);
        onSelect(id);
        onChange();
        return;
      }

      onSelect(null);
    },
    [activeTool, game, logicalFromEvent, onChange, onSelect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = logicalFromEvent(e);

      if (dragRef.current) {
        const { id, dx, dy } = dragRef.current;
        game.move(id, pt.x - dx, pt.y - dy);
        return;
      }

      if (rotateRef.current) {
        const { id } = rotateRef.current;
        const p = game.placements.find((q) => q.id === id);
        if (p) game.rotate(id, Math.atan2(pt.y - p.y, pt.x - p.x));
      }
    },
    [game, logicalFromEvent],
  );

  const endPointer = useCallback(() => {
    const changed = dragRef.current !== null || rotateRef.current !== null;
    dragRef.current = null;
    rotateRef.current = null;
    if (changed) onChange();
  }, [onChange]);

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH * scale}
        height={CANVAS_HEIGHT * scale}
        style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}
        className="game-canvas"
        role="img"
        aria-label={`${game.stage.name} の盤面。${game.stage.hint}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      />
    </div>
  );
}
