"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LAB_SLIDERS,
  applyLabPreset,
  buildLabStage,
  defaultLabParams,
  labReadouts,
  velocityArrow,
  type LabParams,
} from "@/lib/lab";
import { LAB_PRESETS } from "@/physics/presets";
import { buildRenderModel, fitCanvas } from "@/lib/render";
import { drawModel } from "@/lib/draw";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/lib/constants";
import { Simulation } from "@/physics/world";

/**
 * Physics Lab。原仕様 §30〜§35。
 *
 * 値を変えたら世界を**作り直す**。途中の状態に新しいパラメータを差し込むと、
 * 「いまの重力で落ちてきた速度」と「新しい重力」が混ざった状態になり、
 * 何を見ているのか言えなくなる。作り直せば、常に「その設定での運動」が見える。
 */
export default function LabScreen() {
  const [params, setParams] = useState<LabParams>(defaultLabParams);
  const [showVector, setShowVector] = useState(true);
  const [running, setRunning] = useState(true);
  const [readouts, setReadouts] = useState(() => labReadouts(new Simulation({ stage: buildLabStage(defaultLabParams()) })));
  const [scale, setScale] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<Simulation | null>(null);
  const accRef = useRef(0);
  const runningRef = useRef(running);
  const vectorRef = useRef(showVector);
  runningRef.current = running;
  vectorRef.current = showVector;

  const stage = useMemo(() => buildLabStage(params), [params]);

  // 設定が変わったら作り直す。
  useEffect(() => {
    simRef.current = new Simulation({ stage });
    accRef.current = 0;
  }, [stage]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setScale(fitCanvas(el.clientWidth).scale);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    let sinceReadout = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const elapsed = now - prev;
      prev = now;

      const sim = simRef.current;
      if (!sim) return;

      if (runningRef.current) {
        // Slow Motion は「1 フレームで進める tick 数」に効かせる(SPEC D-07 / D-13)。
        const frames = Math.min(4, Math.max(0, Math.round(elapsed / (1000 / 60))));
        accRef.current += frames * params.timeScale;
        const ticks = Math.floor(accRef.current);
        accRef.current -= ticks;

        for (let i = 0; i < ticks; i++) {
          // Lab は決着しない。ボールが落ちたら静かに置き直す。
          if (sim.status !== "RUNNING") {
            simRef.current = new Simulation({ stage });
            accRef.current = 0;
            return;
          }
          sim.step();
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const model = buildRenderModel(sim, stage, new Set());
      drawModel(ctx, model, { scale, reducedMotion: true });

      if (vectorRef.current) {
        const arrow = velocityArrow(sim.ballState());
        if (arrow) drawArrow(ctx, arrow, scale);
      }

      // 表示は毎フレーム更新しない(React の再描画が 60 回/秒 走ると追いつかない)。
      sinceReadout += elapsed;
      if (sinceReadout > 100) {
        sinceReadout = 0;
        setReadouts(labReadouts(sim));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stage, scale, params.timeScale]);

  const reset = useCallback(() => {
    simRef.current = new Simulation({ stage });
    accRef.current = 0;
  }, [stage]);

  return (
    <main className="wrap game-layout">
      <header className="game-head">
        <div>
          <h1 className="game-title">Physics Lab</h1>
          <p className="sub">
            値を動かして、起きることを見る。数値は<strong>この物理エンジンの内部単位</strong>で、
            SI ではない(<Link href="/about">About</Link>)。
          </p>
        </div>
        <nav className="game-nav" aria-label="移動">
          <Link className="game-nav__link" href="/">
            ホーム
          </Link>
          <Link className="game-nav__link" href="/game?stage=1">
            ゲームへ
          </Link>
        </nav>
      </header>

      <div className="lab-body">
        <div className="lab-main">
          <div className="canvas-wrap" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH * scale}
              height={CANVAS_HEIGHT * scale}
              style={{ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale }}
              className="game-canvas"
              role="img"
              aria-label="実験台。ボールの運動を観察する"
            />
          </div>

          <div className="toolbar" role="group" aria-label="操作">
            <button type="button" className="toolbar__btn toolbar__btn--primary" onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Resume"}
            </button>
            <button type="button" className="toolbar__btn" onClick={reset}>
              Reset
            </button>
            <label className="lab-toggle">
              <input type="checkbox" checked={showVector} onChange={(e) => setShowVector(e.target.checked)} />
              速度ベクトルを表示
            </label>
          </div>

          <dl className="lab-readouts">
            {readouts.map((r) => (
              <div key={r.key}>
                <dt>{r.label}</dt>
                <dd>
                  {r.value.toFixed(r.digits)}
                  {r.unit && <span className="lab-unit"> {r.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="lab-side">
          <h2 className="game-side__title">PRESETS</h2>
          <div className="lab-presets">
            {Object.entries(LAB_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                className="lab-preset"
                onClick={() => setParams((p) => applyLabPreset(p, key))}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className="lab-preset" onClick={() => setParams(defaultLabParams())}>
              Reset All
            </button>
          </div>

          <h2 className="game-side__title">PARAMETERS</h2>
          {LAB_SLIDERS.map((s) => {
            const value = s.get(params);
            return (
              <div className="lab-slider" key={s.key}>
                <label htmlFor={`lab-${s.key}`}>
                  <span className="lab-slider__label">{s.label}</span>
                  <span className="lab-slider__value">{value.toFixed(s.step < 0.01 ? 4 : 2)}</span>
                </label>
                <input
                  id={`lab-${s.key}`}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={value}
                  onChange={(e) => setParams((p) => s.set(p, Number(e.target.value)))}
                />
                {s.note && <span className="lab-slider__note">{s.note}</span>}
              </div>
            );
          })}
        </aside>
      </div>
    </main>
  );
}

function drawArrow(ctx: CanvasRenderingContext2D, a: { x1: number; y1: number; x2: number; y2: number }, scale: number) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.strokeStyle = "#ff6b6b";
  ctx.fillStyle = "#ff6b6b";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(a.x1, a.y1);
  ctx.lineTo(a.x2, a.y2);
  ctx.stroke();

  const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const head = 10;
  ctx.beginPath();
  ctx.moveTo(a.x2, a.y2);
  ctx.lineTo(a.x2 - head * Math.cos(angle - 0.4), a.y2 - head * Math.sin(angle - 0.4));
  ctx.lineTo(a.x2 - head * Math.cos(angle + 0.4), a.y2 - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
