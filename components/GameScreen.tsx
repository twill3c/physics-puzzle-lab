"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import GameCanvas from "./GameCanvas";
import GameToolbar from "./GameToolbar";
import ScorePanel from "./ScorePanel";
import ToolPalette from "./ToolPalette";

import { createGame, type Game } from "@/game/gameManager";
import { getStage, stageCount } from "@/game/stageManager";
import { remaining as remainingTools } from "@/game/toolManager";
import { createToolState } from "@/game/toolManager";
import { TIME_SCALES } from "@/lib/constants";
import { isTextFieldTarget, resolveKeyAction } from "@/lib/input";
import { loadSave, recordClear } from "@/lib/storage";
import type { ToolKind } from "@/types/physics";

const SPEEDS = [TIME_SCALES.normal, TIME_SCALES.slow, TIME_SCALES.ultraSlow];

/** 1 面ぶんの画面。原仕様 §9。 */
export default function GameScreen({ stageId }: { stageId: number }) {
  const stage = useMemo(() => getStage(stageId), [stageId]);

  const [game, setGame] = useState<Game>(() => createGame(stage));
  const [activeTool, setActiveTool] = useState<ToolKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [, forceRender] = useState(0);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const recordedRef = useRef(false);

  // 面が変わったら作り直す。
  useEffect(() => {
    setGame(createGame(stage));
    setActiveTool(null);
    setSelectedId(null);
    setSpeedIndex(0);
    recordedRef.current = false;
    setBestScore(loadSave().bestScores[String(stage.id)] ?? null);
  }, [stage]);

  // 動きを減らす設定を尊重する(SPEC N-06 / 原仕様 §46)。
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onChange = useCallback(() => forceRender((n) => n + 1), []);

  // クリアしたら進捗を保存する。1 回だけ。
  useEffect(() => {
    if (game.status === "CLEAR" && game.score && !recordedRef.current) {
      recordedRef.current = true;
      const save = recordClear(stage.id, game.score.total);
      setBestScore(save.bestScores[String(stage.id)] ?? null);
    }
  }, [game.status, game.score, stage.id]);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((i) => {
      const next = (i + 1) % SPEEDS.length;
      game.setTimeScale(SPEEDS[next]);
      return next;
    });
  }, [game]);

  const doStart = useCallback(() => {
    if (game.status === "PAUSED") game.resume();
    else game.start();
    setSelectedId(null);
    onChange();
  }, [game, onChange]);

  const doReset = useCallback(() => {
    game.reset();
    recordedRef.current = false;
    onChange();
  }, [game, onChange]);

  const doDelete = useCallback(() => {
    if (!selectedId) return;
    game.remove(selectedId);
    setSelectedId(null);
    onChange();
  }, [game, selectedId, onChange]);

  // キーボード操作。原仕様 §45。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = resolveKeyAction(e.key, { inTextField: isTextFieldTarget(e.target) });
      if (!action) return;

      e.preventDefault();
      switch (action) {
        case "startPause":
          if (game.status === "RUNNING") {
            game.pause();
            onChange();
          } else doStart();
          break;
        case "reset":
          doReset();
          break;
        case "delete":
          doDelete();
          break;
        case "deselect":
          setSelectedId(null);
          setActiveTool(null);
          break;
        case "slowMotion":
          cycleSpeed();
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, doStart, doReset, doDelete, cycleSpeed, onChange]);

  const toolState = useMemo(() => {
    let s = createToolState(stage);
    for (const p of game.placements) {
      s = { limits: s.limits, placed: new Map(s.placed).set(p.id, p.kind) };
    }
    return s;
  }, [stage, game.placements]);

  const editable = game.status !== "RUNNING" && game.status !== "PAUSED";
  const nextStage = stage.id < stageCount() ? stage.id + 1 : null;
  const selected = selectedId ? (game.placements.find((p) => p.id === selectedId) ?? null) : null;

  return (
    <main className="wrap game-layout">
      <header className="game-head">
        <div>
          <h1 className="game-title">
            Stage {String(stage.id).padStart(2, "0")} — {stage.name}
          </h1>
          <p className="sub">
            <span className="game-theme">{stage.theme}</span> ・{stage.hint}
          </p>
        </div>
        <nav className="game-nav" aria-label="移動">
          <Link className="game-nav__link" href="/stages">
            ステージ一覧
          </Link>
          {nextStage && game.status === "CLEAR" && (
            <Link className="game-nav__link game-nav__link--next" href={`/game?stage=${nextStage}`}>
              次の面へ →
            </Link>
          )}
        </nav>
      </header>

      {/*
        並びは原仕様 §43 に合わせる。デスクトップは左にパレット、
        スマートフォンは Canvas → パレット → 操作ボタン の縦並び。
        そのため 4 つの区画を .game-body の直接の子にして、
        グリッド領域で並べ替える(入れ子にすると順序を変えられない)。
      */}
      <div className="game-body">
        <aside className="game-side" style={{ gridArea: "side" }}>
          <h2 className="game-side__title">TOOLS</h2>
          <ToolPalette
            limits={stage.tools}
            remaining={remainingTools(toolState)}
            active={activeTool}
            onSelect={setActiveTool}
            disabled={!editable}
          />
          {/*
            回転の手段を Shift+ドラッグだけにすると、タッチ端末では板を傾けられない(SPEC D-14)。
            解答の角度は小数 2 桁の rad で持っているので、0.01 刻みならどの解答の角度にも届く。
          */}
          {selected && editable && (
            <div className="lab-slider game-angle">
              <label htmlFor="part-angle">
                <span className="lab-slider__label">角度</span>
                <span className="lab-slider__value">
                  {selected.angle.toFixed(2)} rad({Math.round((selected.angle * 180) / Math.PI)}°)
                </span>
              </label>
              <input
                id="part-angle"
                type="range"
                min={-3.14}
                max={3.14}
                step={0.01}
                value={selected.angle}
                onChange={(e) => {
                  game.rotate(selected.id, Number(e.target.value));
                  onChange();
                }}
              />
            </div>
          )}
          <p className="muted game-hint">
            空いている所を押すと置ける。置いた部品はドラッグで動かせる。
            回すときは、部品を選んで「角度」を動かす(マウスなら Shift を押しながらドラッグしても回る)。
          </p>
        </aside>

        <div style={{ gridArea: "canvas", minWidth: 0 }}>
          <GameCanvas
            game={game}
            activeTool={activeTool}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={onChange}
            reducedMotion={reducedMotion}
          />
        </div>

        <div style={{ gridArea: "toolbar", minWidth: 0 }}>
          <GameToolbar
            status={game.status}
            timeScale={SPEEDS[speedIndex]}
            onStart={doStart}
            onPause={() => {
              game.pause();
              onChange();
            }}
            onReset={doReset}
            onCycleSpeed={cycleSpeed}
            onDelete={doDelete}
            canDelete={selectedId !== null && editable}
          />
        </div>

        <div style={{ gridArea: "score", minWidth: 0 }}>
          <ScorePanel
            status={game.status}
            elapsedTicks={game.elapsedTicks}
            usedObjects={game.placements.length}
            resetCount={game.resetCount}
            score={game.score}
            bestScore={bestScore}
          />
        </div>
      </div>
    </main>
  );
}
