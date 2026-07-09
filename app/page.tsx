"use client";

import { useEffect, useRef, useState } from "react";

const BASE_TICK_SECONDS = 0.78;

type ClockState = {
  stationaryPhase: number;
  movingPhase: number;
  stationaryTicks: number;
  movingTicks: number;
  movingX: number;
  movingSegments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

function photonY(phase: number, top: number, bottom: number) {
  return phase <= 0.5
    ? bottom - (phase / 0.5) * (bottom - top)
    : top + ((phase - 0.5) / 0.5) * (bottom - top);
}

export default function Home() {
  const stationaryCanvas = useRef<HTMLCanvasElement>(null);
  const movingCanvas = useRef<HTMLCanvasElement>(null);
  const betaRef = useRef(0.72);
  const [beta, setBeta] = useState(0.72);
  const [ticks, setTicks] = useState({ stationary: 0, moving: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const pausedRef = useRef(false);
  const resetRef = useRef(0);

  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const movingRate = 1 / gamma;

  useEffect(() => {
    betaRef.current = beta;
  }, [beta]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const canvases = [stationaryCanvas.current, movingCanvas.current];
    if (!canvases[0] || !canvases[1]) return;

    const state: ClockState = {
      stationaryPhase: 0,
      movingPhase: 0,
      stationaryTicks: 0,
      movingTicks: 0,
      movingX: 86,
      movingSegments: [],
    };
    let animationFrame = 0;
    let previous = performance.now();
    let lastUiUpdate = 0;
    let lastReset = resetRef.current;

    const resize = (canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return { width: rect.width, height: rect.height, dpr };
    };

    const roundedRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.fill();
      ctx.stroke();
    };

    const colors = (canvas: HTMLCanvasElement) => {
      const css = getComputedStyle(canvas);
      return {
        ink: css.getPropertyValue("--canvas-ink").trim(),
        muted: css.getPropertyValue("--canvas-muted").trim(),
        grid: css.getPropertyValue("--canvas-grid").trim(),
        warm: css.getPropertyValue("--canvas-warm").trim(),
        cool: css.getPropertyValue("--canvas-cool").trim(),
        panel: css.getPropertyValue("--canvas-panel").trim(),
      };
    };

    const prepare = (canvas: HTMLCanvasElement) => {
      const size = resize(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      return { ctx, ...size, color: colors(canvas) };
    };

    const drawGrid = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      color: string,
      offset: number,
    ) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let x = (offset % 36) - 36; x < width + 36; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 24; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawPhoton = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
    ) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 22);
      glow.addColorStop(0, color);
      glow.addColorStop(0.18, color);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7d7";
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawStationary = () => {
      const setup = prepare(canvases[0]!);
      if (!setup) return;
      const { ctx, width, height, color } = setup;
      const x = width / 2;
      const top = 66;
      const bottom = height - 48;
      drawGrid(ctx, width, height, color.grid, 0);

      ctx.strokeStyle = color.muted;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      ctx.strokeStyle = color.ink;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      [top, bottom].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(x - 55, y);
        ctx.lineTo(x + 55, y);
        ctx.stroke();
      });

      ctx.fillStyle = color.panel;
      ctx.strokeStyle = color.grid;
      ctx.lineWidth = 1;
      roundedRect(ctx, x - 40, bottom + 18, 80, 18, 9);

      const y = photonY(state.stationaryPhase, top, bottom);
      drawPhoton(ctx, x, y, color.warm);
    };

    const drawMoving = () => {
      const setup = prepare(canvases[1]!);
      if (!setup) return;
      const { ctx, width, height, color } = setup;
      const top = 66;
      const bottom = height - 48;
      const x = state.movingX;
      const cameraOffset = -((state.movingX - 86) * 0.22);
      drawGrid(ctx, width, height, color.grid, cameraOffset);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.strokeStyle = color.cool;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.7;
      state.movingSegments.forEach((segment, index) => {
        ctx.globalAlpha = 0.16 + 0.54 * ((index + 1) / Math.max(1, state.movingSegments.length));
        ctx.beginPath();
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(segment.x2, segment.y2);
        ctx.stroke();
      });
      const currentY = photonY(state.movingPhase, top, bottom);
      const previousY = state.movingPhase <= 0.5 ? bottom : top;
      const phaseInLeg = state.movingPhase <= 0.5
        ? state.movingPhase / 0.5
        : (state.movingPhase - 0.5) / 0.5;
      const legDuration = BASE_TICK_SECONDS * (1 / Math.sqrt(1 - betaRef.current ** 2));
      const cPixelsPerSecond = (bottom - top) / BASE_TICK_SECONDS;
      const currentStartX = x - betaRef.current * cPixelsPerSecond * phaseInLeg * legDuration;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(currentStartX, previousY);
      ctx.lineTo(x, currentY);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = color.ink;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      [top, bottom].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(x - 55, y);
        ctx.lineTo(x + 55, y);
        ctx.stroke();
      });

      ctx.fillStyle = color.panel;
      ctx.strokeStyle = color.grid;
      ctx.lineWidth = 1;
      roundedRect(ctx, x - 40, bottom + 18, 80, 18, 9);
      drawPhoton(ctx, x, currentY, color.cool);
    };

    const advance = (now: number) => {
      const rawDt = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      if (lastReset !== resetRef.current) {
        state.stationaryPhase = 0;
        state.movingPhase = 0;
        state.stationaryTicks = 0;
        state.movingTicks = 0;
        state.movingX = 86;
        state.movingSegments = [];
        lastReset = resetRef.current;
      }

      if (!pausedRef.current) {
        const currentBeta = betaRef.current;
        const currentGamma = 1 / Math.sqrt(1 - currentBeta ** 2);
        const stationaryAdvance = rawDt / (BASE_TICK_SECONDS * 2);
        const movingAdvance = rawDt / (BASE_TICK_SECONDS * 2 * currentGamma);
        const oldStationaryLeg = Math.floor(state.stationaryPhase * 2);
        const oldMovingLeg = Math.floor(state.movingPhase * 2);

        state.stationaryPhase += stationaryAdvance;
        state.movingPhase += movingAdvance;
        const movingLightSpeed = (bottomFor(canvases[1]!) - 66) / BASE_TICK_SECONDS;
        state.movingX += currentBeta * movingLightSpeed * rawDt;

        if (state.stationaryPhase >= 1) state.stationaryPhase %= 1;
        if (state.movingPhase >= 1) state.movingPhase %= 1;

        const newStationaryLeg = Math.floor(state.stationaryPhase * 2);
        const newMovingLeg = Math.floor(state.movingPhase * 2);
        if (newStationaryLeg !== oldStationaryLeg || stationaryAdvance > 0.5) {
          state.stationaryTicks += 1;
        }
        if (newMovingLeg !== oldMovingLeg || movingAdvance > 0.5) {
          const bounceY = newMovingLeg === 0 ? bottomFor(canvases[1]!) : 66;
          const oldY = newMovingLeg === 0 ? 66 : bottomFor(canvases[1]!);
          const legTime = BASE_TICK_SECONDS * currentGamma;
          state.movingSegments.push({
            x1: state.movingX - currentBeta * movingLightSpeed * legTime,
            y1: oldY,
            x2: state.movingX,
            y2: bounceY,
          });
          state.movingSegments = state.movingSegments.slice(-7);
          state.movingTicks += 1;
        }

        const movingWidth = canvases[1]!.getBoundingClientRect().width;
        if (state.movingX > movingWidth + 80) {
          state.movingX = 78;
          state.movingSegments = [];
        }
      }

      drawStationary();
      drawMoving();
      if (now - lastUiUpdate > 100) {
        setTicks({
          stationary: state.stationaryTicks,
          moving: state.movingTicks,
        });
        lastUiUpdate = now;
      }
      animationFrame = requestAnimationFrame(advance);
    };

    const bottomFor = (canvas: HTMLCanvasElement) =>
      canvas.getBoundingClientRect().height - 48;

    const observer = new ResizeObserver(() => {
      drawStationary();
      drawMoving();
    });
    canvases.forEach((canvas) => observer.observe(canvas!));
    animationFrame = requestAnimationFrame(advance);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, []);

  const reset = () => {
    resetRef.current += 1;
    setTicks({ stationary: 0, moving: 0 });
  };

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow"><span /> AN INTERACTIVE THOUGHT EXPERIMENT</p>
          <h1>Light keeps its speed.<br /><em>Time</em> has to bend.</h1>
        </div>
        <p className="intro">
          Each flash marks a mirror hit. In the moving clock, light crosses a longer,
          diagonal path—so fewer ticks fit into the same laboratory time.
        </p>
      </header>

      <section className="experiment" aria-label="Two photon clocks comparing stationary and moving time">
        <article className="clock-card stationary-card">
          <div className="clock-header">
            <div>
              <span className="clock-number">01</span>
              <div>
                <h2>Stationary clock</h2>
                <p>LAB FRAME · v = 0</p>
              </div>
            </div>
            <div className="tick-readout" aria-live="polite">
              <strong>{String(ticks.stationary).padStart(2, "0")}</strong>
              <span>TICKS</span>
            </div>
          </div>
          <div className="canvas-shell">
            <canvas
              ref={stationaryCanvas}
              className="clock-canvas"
              aria-label="A stationary photon clock with light traveling vertically between two mirrors"
            />
            <span className="path-label vertical-label">shorter path</span>
          </div>
          <div className="rate-line"><span>Observed rate</span><strong>1.000 ×</strong></div>
        </article>

        <article className="clock-card moving-card">
          <div className="clock-header">
            <div>
              <span className="clock-number">02</span>
              <div>
                <h2>Moving clock</h2>
                <p>LAB VIEW · v = {(beta * 100).toFixed(0)}% c</p>
              </div>
            </div>
            <div className="tick-readout moving-readout" aria-live="polite">
              <strong>{String(ticks.moving).padStart(2, "0")}</strong>
              <span>TICKS</span>
            </div>
          </div>
          <div className="canvas-shell">
            <canvas
              ref={movingCanvas}
              className="clock-canvas"
              aria-label="A moving photon clock where light traces a longer diagonal path between mirrors"
            />
            <span className="path-label angle-label">longer diagonal path</span>
            <span className="motion-arrow">DIRECTION OF MOTION&nbsp;&nbsp;→</span>
          </div>
          <div className="rate-line"><span>Observed rate</span><strong>{movingRate.toFixed(3)} ×</strong></div>
        </article>
      </section>

      <section className="control-deck" aria-label="Velocity controls and Lorentz factor">
        <div className="velocity-control">
          <div className="control-heading">
            <label htmlFor="velocity">VELOCITY OF CLOCK 02</label>
            <strong>{beta.toFixed(2)}<span>c</span></strong>
          </div>
          <input
            id="velocity"
            data-testid="velocity-slider"
            type="range"
            min="0"
            max="0.95"
            step="0.01"
            value={beta}
            onChange={(event) => setBeta(Number(event.target.value))}
            style={{ "--progress": `${(beta / 0.95) * 100}%` } as React.CSSProperties}
            aria-describedby="velocity-scale"
          />
          <div className="range-scale" id="velocity-scale">
            <span>0</span><span>0.25c</span><span>0.50c</span><span>0.75c</span><span>0.95c</span>
          </div>
        </div>

        <div className="gamma-display">
          <div className="gamma-symbol">γ</div>
          <div>
            <span>LORENTZ FACTOR</span>
            <strong>{gamma.toFixed(3)}</strong>
          </div>
          <div className="gamma-formula">
            <span>1</span>
            <span className="fraction-line" />
            <span>√1 − v²/c²</span>
          </div>
        </div>

        <div className="actions">
          <button type="button" onClick={() => setIsPaused((value) => !value)} aria-pressed={isPaused}>
            <span className="button-icon">{isPaused ? "▶" : "Ⅱ"}</span>
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="reset-button" onClick={reset}>Reset ticks</button>
        </div>
      </section>

      <footer>
        <p><span className="footer-mark">✦</span><strong>What you’re seeing</strong></p>
        <p>
          At <strong>{beta.toFixed(2)}c</strong>, every moving-clock tick takes <strong>{gamma.toFixed(3)}× longer</strong>
          from the laboratory’s point of view. The speed of light stays constant; the clock’s time does not.
        </p>
      </footer>
    </main>
  );
}
