"use client";

import { useEffect, useRef, useState } from "react";

const BASE_TICK_SECONDS = 0.78;

type ClockState = {
  stationaryPhase: number;
  stationaryTicks: number;
  movingTicks: number;
  movingX: number;
  movingY: number;
  movingDirection: -1 | 1;
  movingVisualBeta: number;
  movingTrail: Array<{ x: number; y: number; t: number }>;
  movingFlash: { y: number; t: number } | null;
  simTime: number;
};

function photonY(phase: number, top: number, bottom: number) {
  return phase <= 0.5
    ? bottom - (phase / 0.5) * (bottom - top)
    : top + ((phase - 0.5) / 0.5) * (bottom - top);
}

function TimeDilationChart({ beta, gamma }: { beta: number; gamma: number }) {
  const plot = { left: 72, right: 864, top: 28, bottom: 230 };
  const maxGamma = 3.25;
  const xFor = (velocity: number) =>
    plot.left + (velocity / 0.95) * (plot.right - plot.left);
  const yFor = (factor: number) =>
    plot.bottom - ((factor - 1) / (maxGamma - 1)) * (plot.bottom - plot.top);
  const samples = Array.from({ length: 96 }, (_, index) => {
    const velocity = index / 100;
    const factor = 1 / Math.sqrt(1 - velocity * velocity);
    return `${xFor(velocity).toFixed(2)},${yFor(factor).toFixed(2)}`;
  });
  const curve = `M ${samples.join(" L ")}`;
  const area = `${curve} L ${plot.right},${plot.bottom} L ${plot.left},${plot.bottom} Z`;
  const markerX = xFor(beta);
  const markerY = yFor(gamma);
  const labelOnLeft = markerX > 725;

  return (
    <section className="dilation-chart" aria-labelledby="dilation-chart-title">
      <div className="chart-heading">
        <div>
          <p className="chart-kicker">THE RELATIVISTIC CURVE</p>
          <h2 id="dilation-chart-title">Time dilation rises slowly—then all at once.</h2>
        </div>
        <p className="chart-summary">
          At <strong>{beta.toFixed(2)}c</strong>, 1 second aboard the moving clock spans
          <strong> {gamma.toFixed(3)} seconds</strong> in the lab.
        </p>
      </div>
      <svg
        className="gamma-chart"
        viewBox="0 0 900 285"
        role="img"
        aria-label={`Lorentz factor curve from zero to 0.95 times light speed. The selected velocity is ${beta.toFixed(2)}c with a Lorentz factor of ${gamma.toFixed(3)}.`}
      >
        <title>Lorentz factor by velocity</title>
        <desc>The curve becomes sharply steeper as velocity approaches the speed of light.</desc>
        {[1, 1.5, 2, 2.5, 3].map((factor) => (
          <g key={factor}>
            <line className="chart-grid-line" x1={plot.left} x2={plot.right} y1={yFor(factor)} y2={yFor(factor)} />
            <text className="chart-axis-label" x={plot.left - 14} y={yFor(factor) + 4} textAnchor="end">{factor.toFixed(1)}×</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 0.95].map((velocity) => (
          <g key={velocity}>
            <line className="chart-tick" x1={xFor(velocity)} x2={xFor(velocity)} y1={plot.bottom} y2={plot.bottom + 6} />
            <text className="chart-axis-label" x={xFor(velocity)} y={plot.bottom + 23} textAnchor="middle">
              {velocity === 0 ? "0" : `${velocity.toFixed(2)}c`}
            </text>
          </g>
        ))}
        <path className="chart-area" d={area} />
        <path className="chart-curve" d={curve} />
        <line className="chart-marker-line" x1={markerX} x2={markerX} y1={markerY} y2={plot.bottom} />
        <circle className="chart-marker-halo" cx={markerX} cy={markerY} r="12" />
        <circle className="chart-marker" cx={markerX} cy={markerY} r="5" />
        <text
          className="chart-marker-label"
          x={markerX + (labelOnLeft ? -14 : 14)}
          y={Math.max(markerY - 10, 22)}
          textAnchor={labelOnLeft ? "end" : "start"}
        >
          γ {gamma.toFixed(3)}
        </text>
        <text className="chart-axis-title" x={(plot.left + plot.right) / 2} y="278" textAnchor="middle">VELOCITY</text>
        <text className="chart-axis-title" transform="translate(16 140) rotate(-90)" textAnchor="middle">LAB TIME PER MOVING SECOND</text>
      </svg>
    </section>
  );
}

function TimeDilationView() {
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
  const photonPathAngle = Math.atan2(Math.sqrt(1 - beta * beta), beta) * (180 / Math.PI);

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
      stationaryTicks: 0,
      movingTicks: 0,
      movingX: 0,
      movingY: 0,
      movingDirection: -1,
      movingVisualBeta: betaRef.current,
      movingTrail: [],
      movingFlash: null,
      simTime: 0,
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
      const x = width * 0.58;
      const cameraX = state.movingX - x;
      drawGrid(ctx, width, height, color.grid, -cameraX);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.strokeStyle = color.cool;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let index = 1; index < state.movingTrail.length; index += 1) {
        const previousPoint = state.movingTrail[index - 1];
        const point = state.movingTrail[index];
        const age = Math.max(0, (state.simTime - point.t) / 3.6);
        const alpha = Math.max(0, 1 - age) ** 2;
        ctx.globalAlpha = alpha * 0.22;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(previousPoint.x - cameraX, previousPoint.y);
        ctx.lineTo(point.x - cameraX, point.y);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.88;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(previousPoint.x - cameraX, previousPoint.y);
        ctx.lineTo(point.x - cameraX, point.y);
        ctx.stroke();
      }
      const currentY = Math.max(top, Math.min(bottom, state.movingY || bottom));
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
      if (state.movingFlash) {
        const flashAge = state.simTime - state.movingFlash.t;
        if (flashAge < 0.38) {
          const radius = 12 + flashAge * 62;
          const flash = ctx.createRadialGradient(x, state.movingFlash.y, 0, x, state.movingFlash.y, radius);
          flash.addColorStop(0, `rgba(26, 165, 155, ${0.35 * (1 - flashAge / 0.38)})`);
          flash.addColorStop(1, "rgba(26, 165, 155, 0)");
          ctx.fillStyle = flash;
          ctx.beginPath();
          ctx.arc(x, state.movingFlash.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      drawPhoton(ctx, x, currentY, color.cool);
    };

    const advance = (now: number) => {
      const rawDt = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      if (lastReset !== resetRef.current) {
        state.stationaryPhase = 0;
        state.stationaryTicks = 0;
        state.movingTicks = 0;
        state.movingX = 0;
        state.movingY = bottomFor(canvases[1]!);
        state.movingDirection = -1;
        state.movingVisualBeta = betaRef.current;
        state.movingTrail = [{ x: 0, y: state.movingY, t: 0 }];
        state.movingFlash = null;
        state.simTime = 0;
        lastReset = resetRef.current;
      }

      if (!pausedRef.current) {
        state.simTime += rawDt;
        const blend = 1 - Math.exp(-rawDt * 8);
        state.movingVisualBeta += (betaRef.current - state.movingVisualBeta) * blend;
        const currentBeta = state.movingVisualBeta;
        const currentGamma = 1 / Math.sqrt(1 - currentBeta ** 2);
        const stationaryAdvance = rawDt / (BASE_TICK_SECONDS * 2);
        const oldStationaryLeg = Math.floor(state.stationaryPhase * 2);

        state.stationaryPhase += stationaryAdvance;
        const movingBottom = bottomFor(canvases[1]!);
        if (state.movingY <= 0 || state.movingY > movingBottom) state.movingY = movingBottom;
        const movingLightSpeed = (movingBottom - 66) / BASE_TICK_SECONDS;
        const oldX = state.movingX;
        const oldY = state.movingY;
        const horizontalStep = currentBeta * movingLightSpeed * rawDt;
        const verticalStep = state.movingDirection * (movingLightSpeed / currentGamma) * rawDt;
        state.movingX = oldX + horizontalStep;
        let nextY = oldY + verticalStep;
        if (nextY < 66 || nextY > movingBottom) {
          const mirrorY = nextY < 66 ? 66 : movingBottom;
          const collisionFraction = Math.max(0, Math.min(1, (mirrorY - oldY) / verticalStep));
          state.movingTrail.push({
            x: oldX + horizontalStep * collisionFraction,
            y: mirrorY,
            t: state.simTime - rawDt + rawDt * collisionFraction,
          });
          if (nextY < 66) {
            nextY = 66 + (66 - nextY);
            state.movingDirection = 1;
          } else {
            nextY = movingBottom - (nextY - movingBottom);
            state.movingDirection = -1;
          }
          state.movingTicks += 1;
          state.movingFlash = { y: mirrorY, t: state.simTime };
        }
        state.movingY = nextY;
        state.movingTrail.push({ x: state.movingX, y: state.movingY, t: state.simTime });
        while (state.movingTrail.length > 2 && state.simTime - state.movingTrail[0].t > 3.6) {
          state.movingTrail.shift();
        }
        if (state.movingTrail.length > 420) state.movingTrail.splice(0, state.movingTrail.length - 420);

        if (state.stationaryPhase >= 1) state.stationaryPhase %= 1;

        const newStationaryLeg = Math.floor(state.stationaryPhase * 2);
        if (newStationaryLeg !== oldStationaryLeg || stationaryAdvance > 0.5) {
          state.stationaryTicks += 1;
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

    state.movingY = bottomFor(canvases[1]!);
    state.movingTrail = [{ x: 0, y: state.movingY, t: 0 }];

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
    <div className="time-dilation-view">
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
              aria-label="A tracking-camera view of a moving photon clock where light traces a longer diagonal path between mirrors"
            />
            <span className="camera-lock"><span /> CAMERA LOCKED TO CLOCK</span>
            <span
              className="path-label angle-label"
              style={{ "--path-angle": `${-photonPathAngle}deg` } as React.CSSProperties}
            >longer diagonal path</span>
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

      <TimeDilationChart beta={beta} gamma={gamma} />

      <footer>
        <p><span className="footer-mark">✦</span><strong>What you’re seeing</strong></p>
        <p>
          At <strong>{beta.toFixed(2)}c</strong>, every moving-clock tick takes <strong>{gamma.toFixed(3)}× longer</strong>
          from the laboratory’s point of view. The speed of light stays constant; the clock’s time does not.
        </p>
      </footer>
    </div>
  );
}

type MemoryTier = {
  id: string;
  label: string;
  detail: string;
  relativeSpeed: number;
  category: "cache" | "memory" | "storage";
};

const MEMORY_TIERS: MemoryTier[] = [
  { id: "hdd", label: "Hard drive", detail: "Mechanical storage · baseline", relativeSpeed: 1, category: "storage" },
  { id: "ssd", label: "SSD", detail: "Solid-state storage", relativeSpeed: 100, category: "storage" },
  { id: "ddr5", label: "DDR5", detail: "System memory", relativeSpeed: 100_000, category: "memory" },
  { id: "l3", label: "L3 cache", detail: "Shared cache", relativeSpeed: 1_000_000, category: "cache" },
  { id: "l2", label: "L2 cache", detail: "Closer to the core", relativeSpeed: 3_000_000, category: "cache" },
  { id: "l1", label: "L1 cache", detail: "Closest to the core", relativeSpeed: 10_000_000, category: "cache" },
];

function formatRelativeSpeed(speed: number) {
  if (speed >= 1_000_000) return `${speed / 1_000_000}M×`;
  if (speed >= 1_000) return `${speed / 1_000}K×`;
  return `${speed}×`;
}

const HDD_TRIP_MS = 8_000_000_000;

function formatTripTime(milliseconds: number) {
  const day = 86_400_000;
  const hour = 3_600_000;
  if (milliseconds >= day) return `${(milliseconds / day).toFixed(1)} days`;
  if (milliseconds >= hour) return `${(milliseconds / hour).toFixed(1)} hours`;
  if (milliseconds >= 60_000) {
    const minutes = Math.floor(milliseconds / 60_000);
    const seconds = Math.round((milliseconds % 60_000) / 1000);
    return `${minutes} min ${seconds} sec`;
  }
  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)} seconds`;
}

function MemorySpeedView() {
  const dotRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const progressRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const progressTextRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      MEMORY_TIERS.forEach((tier, index) => {
        const position = 0.18 + index * 0.14;
        if (dotRefs.current[tier.id]) dotRefs.current[tier.id]!.style.left = `${position * 100}%`;
        if (progressRefs.current[tier.id]) progressRefs.current[tier.id]!.style.width = `${position * 100}%`;
      });
      return;
    }

    const start = performance.now();
    let frame = 0;
    let lastTextUpdate = 0;
    const animate = (now: number) => {
      MEMORY_TIERS.forEach((tier) => {
        const oneWayDurationMs = HDD_TRIP_MS / tier.relativeSpeed;
        const trip = (now - start) / oneWayDurationMs;
        const phase = trip % 2;
        const position = phase <= 1 ? phase : 2 - phase;
        const dot = dotRefs.current[tier.id];
        const progress = progressRefs.current[tier.id];
        if (dot) dot.style.left = `${position * 100}%`;
        if (progress) progress.style.width = `${position * 100}%`;
        if (now - lastTextUpdate > 100 && progressTextRefs.current[tier.id]) {
          const precision = tier.relativeSpeed <= 100 ? 5 : tier.relativeSpeed < 1_000_000 ? 2 : 1;
          progressTextRefs.current[tier.id]!.textContent = `${(position * 100).toFixed(precision)}% across`;
        }
      });
      if (now - lastTextUpdate > 100) lastTextUpdate = now;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="memory-speed-view">
      <header className="memory-hero">
        <div>
          <p className="eyebrow"><span /> COMPUTER ARCHITECTURE · 02</p>
          <h1>A nanosecond<br />is a <em>world.</em></h1>
        </div>
        <p className="intro">
          Every point travels the same distance on one literal relative scale. L1 crosses in
          0.8 seconds. At 1/10,000,000th the speed, the hard drive needs more than three months.
        </p>
      </header>

      <div className="race-explainer">
        <div><span className="explainer-dot" /> SLOWEST AT TOP · FASTEST AT BOTTOM</div>
        <p><strong>True relative motion.</strong> 0.8 sec for L1 = 92.6 days for HDD.</p>
      </div>

      <section className="memory-race" aria-label="Literal relative memory and storage speed race">
        <div className="race-key">
          <span>REQUEST START</span>
          <span>DATA ARRIVES</span>
        </div>
        {MEMORY_TIERS.map((tier, index) => (
            <article
              className={`memory-lane memory-${tier.category}`}
              key={tier.id}
            >
              <div className="memory-label">
                <span className="memory-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{tier.label}</h2>
                  <p>{tier.detail}</p>
                </div>
              </div>
              <div className="memory-motion">
                <div className="memory-track">
                  <span
                    className="memory-progress"
                    ref={(element) => { progressRefs.current[tier.id] = element; }}
                  />
                  <span
                    className="memory-dot"
                    ref={(element) => { dotRefs.current[tier.id] = element; }}
                    aria-hidden="true"
                  />
                </div>
                <div className="memory-meta">
                  <span className="speed-number"><strong>{formatRelativeSpeed(tier.relativeSpeed)}</strong> relative speed</span>
                  <span><strong>{formatTripTime(HDD_TRIP_MS / tier.relativeSpeed)}</strong> per one-way trip</span>
                  <span
                    className="live-progress"
                    ref={(element) => { progressTextRefs.current[tier.id] = element; }}
                    aria-live="off"
                  >0% across</span>
                </div>
              </div>
            </article>
        ))}
      </section>

      <footer className="memory-note">
        <p><span className="footer-mark">✦</span><strong>How to read the race</strong></p>
        <p>
          The displayed multipliers and movement now use exactly the same scale. Slow points may appear
          stationary, so their live percentage reveals the tiny distance covered while cache races past.
        </p>
      </footer>
    </div>
  );
}

type BandwidthTier = {
  id: string;
  label: string;
  detail: string;
  bandwidth: number;
};

const BANDWIDTH_TIERS: BandwidthTier[] = [
  { id: "pc-ddr5", label: "PC DDR5", detail: "Dual-channel DDR5-6400", bandwidth: 102.4 },
  { id: "mac-studio", label: "Mac Studio", detail: "M3 Ultra unified memory", bandwidth: 819 },
  { id: "rtx-5090", label: "RTX 5090", detail: "GDDR7 graphics memory", bandwidth: 1_792 },
  { id: "blackwell-ultra", label: "Blackwell Ultra", detail: "HBM3e accelerator memory", bandwidth: 8_000 },
];

const DDR5_CROSSING_SECONDS = 8;

function formatBandwidth(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} GB/s`;
}

function MemoryBandwidthView() {
  const dotRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      BANDWIDTH_TIERS.forEach((tier, index) => {
        if (dotRefs.current[tier.id]) dotRefs.current[tier.id]!.style.left = `${20 + index * 20}%`;
      });
      return;
    }

    const start = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      BANDWIDTH_TIERS.forEach((tier) => {
        const crossingMs = DDR5_CROSSING_SECONDS * 1000 * (BANDWIDTH_TIERS[0].bandwidth / tier.bandwidth);
        const phase = ((now - start) / crossingMs) % 2;
        const position = phase <= 1 ? phase : 2 - phase;
        if (dotRefs.current[tier.id]) dotRefs.current[tier.id]!.style.left = `${position * 100}%`;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="bandwidth-view">
      <header className="bandwidth-hero">
        <div>
          <p className="eyebrow"><span /> COMPUTER ARCHITECTURE · 03</p>
          <h1>How wide is<br />the <em>pipe?</em></h1>
        </div>
        <p className="intro">
          Give every memory system the same block of data. The white points move at literal
          bandwidth ratios, turning gigabytes per second into distance you can see.
        </p>
      </header>

      <section className="bandwidth-race" aria-label="Memory bandwidth motion comparison">
        <header className="bandwidth-race-header">
          <div><span /> SAME DISTANCE · SAME DATA BLOCK</div>
          <p>PC DDR5 is anchored at <strong>{DDR5_CROSSING_SECONDS.toFixed(0)} seconds</strong> per crossing.</p>
        </header>
        <div className="bandwidth-column-heads" aria-hidden="true">
          <span>MEMORY SYSTEM</span><span>DATA IN MOTION</span><span>BANDWIDTH</span><span>ONE CROSSING</span>
        </div>
        {BANDWIDTH_TIERS.map((tier, index) => {
          const crossingSeconds = DDR5_CROSSING_SECONDS * (BANDWIDTH_TIERS[0].bandwidth / tier.bandwidth);
          return (
            <article className="bandwidth-lane" key={tier.id}>
              <div className="bandwidth-label">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h2>{tier.label}</h2><p>{tier.detail}</p></div>
              </div>
              <div className="bandwidth-track">
                <span className="bandwidth-terminal start" />
                <span
                  className="bandwidth-dot"
                  ref={(element) => { dotRefs.current[tier.id] = element; }}
                  aria-hidden="true"
                />
                <span className="bandwidth-terminal end" />
              </div>
              <strong className="bandwidth-value">{formatBandwidth(tier.bandwidth)}</strong>
              <strong className="crossing-value">{crossingSeconds.toFixed(2)} sec</strong>
            </article>
          );
        })}
      </section>

      <footer className="bandwidth-note">
        <p><span className="footer-mark">✦</span><strong>What the motion means</strong></p>
        <p>
          The track length represents one equal-sized transfer. Because crossing time is inversely
          proportional to bandwidth, an 8 TB/s lane crosses exactly 78.125× faster than 102.4 GB/s.
        </p>
      </footer>
    </div>
  );
}

type ViewId = "time-dilation" | "memory-speed" | "memory-bandwidth";

export default function Home() {
  const [view, setView] = useState<ViewId>("time-dilation");

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === "#memory-speed") setView("memory-speed");
      else if (window.location.hash === "#memory-bandwidth") setView("memory-bandwidth");
      else setView("time-dilation");
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <main className="app-shell">
      <aside className="site-nav">
        <div className="nav-brand">
          <span className="brand-orbit"><span /></span>
          <div><strong>Visual Atlas</strong><span>Ideas in motion</span></div>
        </div>
        <nav aria-label="Visualization library">
          <p>EXPERIMENTS</p>
          <a
            href="#time-dilation"
            className={view === "time-dilation" ? "is-active" : ""}
            aria-current={view === "time-dilation" ? "page" : undefined}
            onClick={() => setView("time-dilation")}
          >
            <span className="nav-number">01</span>
            <span><strong>Time dilation</strong><small>Special relativity</small></span>
          </a>
          <a
            href="#memory-speed"
            className={view === "memory-speed" ? "is-active" : ""}
            aria-current={view === "memory-speed" ? "page" : undefined}
            onClick={() => setView("memory-speed")}
          >
            <span className="nav-number">02</span>
            <span><strong>Memory speed</strong><small>Computer architecture</small></span>
          </a>
          <a
            href="#memory-bandwidth"
            className={view === "memory-bandwidth" ? "is-active" : ""}
            aria-current={view === "memory-bandwidth" ? "page" : undefined}
            onClick={() => setView("memory-bandwidth")}
          >
            <span className="nav-number">03</span>
            <span><strong>Memory bandwidth</strong><small>Throughput in motion</small></span>
          </a>
        </nav>
        <div className="nav-footer"><span>03</span> INTERACTIVE STUDIES</div>
      </aside>
      <section className="view-stage" aria-live="polite">
        {view === "time-dilation" && <TimeDilationView />}
        {view === "memory-speed" && <MemorySpeedView />}
        {view === "memory-bandwidth" && <MemoryBandwidthView />}
      </section>
    </main>
  );
}
