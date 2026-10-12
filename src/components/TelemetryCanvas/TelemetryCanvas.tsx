import React, { useRef, useEffect, useCallback } from 'react';
import styles from './TelemetryCanvas.module.scss';
import { useTelemetry } from '../../context/useTelemetry';
import type { TelemetryPoint } from '../../types/telemetry';

// Visual design color tokens matching _variables.scss
const COLORS = {
  bgPanel: '#0e1219',
  bgPrimary: '#0a0c10',
  borderPanel: '#1b1f2b',
  borderSubtle: '#141824',
  gridLine: '#161b26',
  refTrace: '#00f0ff',       // Cyan (Lap 1)
  compTrace: '#ff3864',      // Crimson (Lap 2)
  throttleTrace: '#00e676',  // Green
  brakeTrace: '#ff1744',     // Red
  deltaTrace: '#e0b0ff',     // Purple / Lavender
  textSecondary: '#8b949e',
  textMuted: '#484f58',
  crosshair: '#ffffff',
  crosshairGlow: 'rgba(0, 240, 255, 0.4)',
};

interface ChannelLayout {
  id: string;
  title: string;
  top: number;
  height: number;
  minVal: number;
  maxVal: number;
  unit: string;
}

export const TelemetryCanvas: React.FC = () => {
  const {
    session,
    activeDistance,
    hoveredPointRef,
    hoveredPointComp,
    deltaAtHover,
    isHovering,
    setActiveDistance,
    setIsHovering,
  } = useTelemetry();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lastRefDist = session.referenceLap?.[session.referenceLap.length - 1]?.distance;
  const totalTrackLength = lastRefDist && lastRefDist > 1000 ? Math.round(lastRefDist) : 5793;

  // Margins within canvas
  const padding = { top: 28, bottom: 24, left: 58, right: 28 };

  // Render pipeline
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background
    ctx.fillStyle = COLORS.bgPanel;
    ctx.fillRect(0, 0, width, height);

    const plotWidth = width - padding.left - padding.right;
    const availableHeight = height - padding.top - padding.bottom;
    const channelGap = 16;
    const channelCount = 3;
    const channelHeight = Math.floor((availableHeight - channelGap * (channelCount - 1)) / channelCount);

    const refLap = session.referenceLap;
    const compLap = session.comparisonLap;

    // Calculate maximum observed delta to auto-scale delta channel beyond ±0.5s if needed
    let maxObservedDelta = 0;
    if (refLap && compLap) {
      const len = Math.min(refLap.length, compLap.length);
      for (let i = 0; i < len; i++) {
        const d = Math.abs((compLap[i]?.time ?? 0) - (refLap[i]?.time ?? 0));
        if (d > maxObservedDelta) maxObservedDelta = d;
      }
    }
    const deltaLimit = maxObservedDelta > 0.5 ? Math.ceil(maxObservedDelta * 4) / 4 : 0.5;

    const refColor = session.driver1Meta?.teamColor || COLORS.refTrace;
    const compColor = session.driver2Meta?.teamColor || COLORS.compTrace;
    const refCode = session.driver1Meta?.driverCode || 'LAP 1';
    const compCode = session.driver2Meta?.driverCode || 'LAP 2';

    const channels: ChannelLayout[] = [
      {
        id: 'speed',
        title: `SPEED (${refCode} vs ${compCode})`,
        top: padding.top,
        height: channelHeight,
        minVal: 0,
        maxVal: 360,
        unit: 'km/h',
      },
      {
        id: 'pedals',
        title: 'THROTTLE & BRAKE',
        top: padding.top + channelHeight + channelGap,
        height: channelHeight,
        minVal: 0,
        maxVal: 100,
        unit: '%',
      },
      {
        id: 'delta',
        title: `DELTA TIME (${compCode} vs ${refCode})`,
        top: padding.top + (channelHeight + channelGap) * 2,
        height: channelHeight,
        minVal: -deltaLimit,
        maxVal: deltaLimit,
        unit: 's',
      },
    ];

    // Helper functions to map coordinates
    const getX = (dist: number): number => {
      const clamped = Math.max(0, Math.min(totalTrackLength, dist));
      return padding.left + (clamped / totalTrackLength) * plotWidth;
    };

    const getY = (val: number, channel: ChannelLayout): number => {
      const span = channel.maxVal - channel.minVal;
      const norm = (val - channel.minVal) / (span || 1);
      return channel.top + channel.height - norm * channel.height;
    };

    // 2. Draw background distance grid marks (every 500m)
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.borderPanel;
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '10px "JetBrains Mono", Menlo, Consolas, monospace';

    for (let dist = 0; dist <= totalTrackLength; dist += 500) {
      const x = getX(dist);
      ctx.beginPath();
      ctx.moveTo(x, padding.top - 8);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();

      // Label at bottom
      ctx.textAlign = 'center';
      ctx.fillText(`${dist}m`, x, height - 8);
    }

    // 3. Render each channel's background, borders, and y-axis ticks
    channels.forEach((ch) => {
      // Channel bounding box
      ctx.fillStyle = 'rgba(10, 12, 16, 0.4)';
      ctx.fillRect(padding.left, ch.top, plotWidth, ch.height);

      ctx.strokeStyle = COLORS.borderSubtle;
      ctx.strokeRect(padding.left, ch.top, plotWidth, ch.height);

      // Channel title & unit badge
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = '600 10px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ch.title, padding.left + 8, ch.top - 6);

      // Y-axis grid lines and labels
      ctx.font = '9px "JetBrains Mono", Menlo, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.textMuted;

      const deltaStep = deltaLimit === 0.5 ? 0.2 : deltaLimit / 2;
      const yTicks =
        ch.id === 'delta'
          ? deltaLimit === 0.5
            ? [-0.4, -0.2, 0, 0.2, 0.4]
            : [-deltaLimit, -deltaStep, 0, deltaStep, deltaLimit]
          : [0, 0.5, 1.0];

      if (ch.id === 'delta') {
        // Zero baseline emphasis
        const zeroY = getY(0, ch);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(padding.left + plotWidth, zeroY);
        ctx.stroke();

        yTicks.forEach((tickVal) => {
          const y = getY(tickVal, ch);
          ctx.strokeStyle = COLORS.gridLine;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + plotWidth, y);
          ctx.stroke();

          const label = `${tickVal > 0 ? '+' : ''}${tickVal % 1 === 0 ? tickVal.toFixed(0) : tickVal.toFixed(1)}s`;
          ctx.fillText(label, padding.left - 6, y + 3);
        });
      } else {
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
          const tickVal = ch.minVal + (i / steps) * (ch.maxVal - ch.minVal);
          const y = getY(tickVal, ch);

          ctx.strokeStyle = COLORS.gridLine;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(padding.left + plotWidth, y);
          ctx.stroke();

          const label = ch.id === 'speed' ? `${Math.round(tickVal)}` : `${Math.round(tickVal)}%`;
          ctx.fillText(label, padding.left - 6, y + 3);
        }
      }
    });

    // 4. Plot Channel 1: SPEED (Lap 1 vs Lap 2)
    const speedCh = channels[0]!;

    // Speed - Lap 1 (Ref)
    if (refLap.length > 0) {
      ctx.strokeStyle = refColor;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      refLap.forEach((pt: TelemetryPoint, idx: number) => {
        const x = getX(pt.distance);
        const y = getY(pt.speed, speedCh);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Speed - Lap 2 (Comp)
    if (compLap.length > 0) {
      ctx.strokeStyle = compColor;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      compLap.forEach((pt: TelemetryPoint, idx: number) => {
        const x = getX(pt.distance);
        const y = getY(pt.speed, speedCh);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 5. Plot Channel 2: PEDALS (Throttle & Brake with subtle gradient fill)
    const pedalsCh = channels[1]!;

    // Throttle Fill & Stroke (Lap 1 throttle as primary driver profile)
    if (refLap.length > 0) {
      // Area Fill
      const throttleBaselineY = getY(0, pedalsCh);
      const throttleGrad = ctx.createLinearGradient(0, pedalsCh.top, 0, pedalsCh.top + pedalsCh.height);
      throttleGrad.addColorStop(0, 'rgba(0, 230, 118, 0.22)');
      throttleGrad.addColorStop(1, 'rgba(0, 230, 118, 0.01)');

      ctx.fillStyle = throttleGrad;
      ctx.beginPath();
      ctx.moveTo(getX(refLap[0]!.distance), throttleBaselineY);
      refLap.forEach((pt: TelemetryPoint) => {
        const x = getX(pt.distance);
        const y = getY(pt.throttle * 100, pedalsCh);
        ctx.lineTo(x, y);
      });
      ctx.lineTo(getX(refLap[refLap.length - 1]!.distance), throttleBaselineY);
      ctx.closePath();
      ctx.fill();

      // Stroke Line
      ctx.strokeStyle = COLORS.throttleTrace;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      refLap.forEach((pt: TelemetryPoint, idx: number) => {
        const x = getX(pt.distance);
        const y = getY(pt.throttle * 100, pedalsCh);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Brake Fill & Stroke
      const brakeBaselineY = getY(0, pedalsCh);
      const brakeGrad = ctx.createLinearGradient(0, pedalsCh.top, 0, pedalsCh.top + pedalsCh.height);
      brakeGrad.addColorStop(0, 'rgba(255, 23, 68, 0.26)');
      brakeGrad.addColorStop(1, 'rgba(255, 23, 68, 0.01)');

      ctx.fillStyle = brakeGrad;
      ctx.beginPath();
      ctx.moveTo(getX(refLap[0]!.distance), brakeBaselineY);
      refLap.forEach((pt: TelemetryPoint) => {
        const x = getX(pt.distance);
        const y = getY(pt.brake * 100, pedalsCh);
        ctx.lineTo(x, y);
      });
      ctx.lineTo(getX(refLap[refLap.length - 1]!.distance), brakeBaselineY);
      ctx.closePath();
      ctx.fill();

      // Brake Stroke Line
      ctx.strokeStyle = COLORS.brakeTrace;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      refLap.forEach((pt: TelemetryPoint, idx: number) => {
        const x = getX(pt.distance);
        const y = getY(pt.brake * 100, pedalsCh);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 6. Plot Channel 3: DELTA TIME (Lap 2 vs Lap 1)
    const deltaCh = channels[2]!;
    const zeroY = getY(0, deltaCh);

    if (refLap.length > 0 && compLap.length > 0) {
      // Area Fill for Delta (Slower vs Faster relative to zero)
      ctx.save();
      ctx.beginPath();
      refLap.forEach((pRef: TelemetryPoint, idx: number) => {
        const pComp = compLap[idx] ?? pRef;
        const delta = pComp.time - pRef.time;
        const x = getX(pRef.distance);
        const y = getY(delta, deltaCh);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(getX(refLap[refLap.length - 1]!.distance), zeroY);
      ctx.lineTo(getX(refLap[0]!.distance), zeroY);
      ctx.closePath();

      const deltaGrad = ctx.createLinearGradient(0, deltaCh.top, 0, deltaCh.top + deltaCh.height);
      deltaGrad.addColorStop(0, 'rgba(255, 56, 100, 0.20)');
      deltaGrad.addColorStop(0.5, 'rgba(224, 176, 255, 0.05)');
      deltaGrad.addColorStop(1, 'rgba(0, 230, 118, 0.20)');
      ctx.fillStyle = deltaGrad;
      ctx.fill();
      ctx.restore();

      // Delta Trace Line
      ctx.strokeStyle = COLORS.deltaTrace;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      refLap.forEach((pRef: TelemetryPoint, idx: number) => {
        const pComp = compLap[idx] ?? pRef;
        const delta = pComp.time - pRef.time;
        const x = getX(pRef.distance);
        const y = getY(delta, deltaCh);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 7. Synchronized Inspection Crosshair Line & Channel Dots
    if (isHovering || activeDistance > 0) {
      const cursorX = getX(activeDistance);

      // Vertical cursor line across all channels
      ctx.save();
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);

      ctx.beginPath();
      ctx.moveTo(cursorX, padding.top - 8);
      ctx.lineTo(cursorX, height - padding.bottom);
      ctx.stroke();
      ctx.restore();

      // Glowing vertical line halo
      ctx.strokeStyle = COLORS.crosshairGlow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cursorX, padding.top - 8);
      ctx.lineTo(cursorX, height - padding.bottom);
      ctx.stroke();

      // Channel 1 Crosshair Snap Dots (Speed)
      if (hoveredPointRef) {
        const y1 = getY(hoveredPointRef.speed, speedCh);
        ctx.fillStyle = refColor;
        ctx.beginPath();
        ctx.arc(cursorX, y1, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (hoveredPointComp) {
        const y2 = getY(hoveredPointComp.speed, speedCh);
        ctx.fillStyle = compColor;
        ctx.beginPath();
        ctx.arc(cursorX, y2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Channel 2 Crosshair Snap Dots (Throttle & Brake)
      if (hoveredPointRef) {
        const yt = getY(hoveredPointRef.throttle * 100, pedalsCh);
        ctx.fillStyle = COLORS.throttleTrace;
        ctx.beginPath();
        ctx.arc(cursorX, yt, 3.5, 0, Math.PI * 2);
        ctx.fill();

        const yb = getY(hoveredPointRef.brake * 100, pedalsCh);
        ctx.fillStyle = COLORS.brakeTrace;
        ctx.beginPath();
        ctx.arc(cursorX, yb, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Channel 3 Crosshair Snap Dot (Delta)
      if (deltaAtHover !== null) {
        const yd = getY(deltaAtHover, deltaCh);
        ctx.fillStyle = COLORS.deltaTrace;
        ctx.beginPath();
        ctx.arc(cursorX, yd, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distance indicator flag at bottom of crosshair
      ctx.fillStyle = 'rgba(14, 18, 25, 0.9)';
      ctx.strokeStyle = refColor;
      ctx.lineWidth = 1;
      const tagText = `${Math.round(activeDistance)}m`;
      ctx.font = '700 9px "JetBrains Mono", Menlo, monospace';
      const tagWidth = ctx.measureText(tagText).width + 8;
      const tagX = Math.max(padding.left, Math.min(width - padding.right - tagWidth, cursorX - tagWidth / 2));
      const tagY = height - padding.bottom + 4;

      ctx.fillRect(tagX, tagY, tagWidth, 14);
      ctx.strokeRect(tagX, tagY, tagWidth, 14);
      ctx.fillStyle = refColor;
      ctx.textAlign = 'center';
      ctx.fillText(tagText, tagX + tagWidth / 2, tagY + 10);
    }

    ctx.restore();
  }, [
    session,
    activeDistance,
    hoveredPointRef,
    hoveredPointComp,
    deltaAtHover,
    isHovering,
    padding.top,
    padding.bottom,
    padding.left,
    padding.right,
    totalTrackLength,
  ]);

  // Handle Resize with ResizeObserver & devicePixelRatio
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        render();
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [render]);

  // Redraw when telemetry state changes
  useEffect(() => {
    render();
  }, [render]);

  // Mouse / Pointer Interaction handlers
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const plotWidth = rect.width - padding.left - padding.right;

      if (pointerX < padding.left || pointerX > rect.width - padding.right) {
        return;
      }

      const ratio = (pointerX - padding.left) / plotWidth;
      const targetDist = Math.max(0, Math.min(totalTrackLength, ratio * totalTrackLength));

      setActiveDistance(targetDist);
      setIsHovering(true);
    },
    [padding.left, padding.right, totalTrackLength, setActiveDistance, setIsHovering]
  );

  const handlePointerLeave = useCallback(() => {
    setIsHovering(false);
  }, [setIsHovering]);

  const speedDelta =
    hoveredPointRef && hoveredPointComp ? hoveredPointComp.speed - hoveredPointRef.speed : 0;

  return (
    <div className={styles.canvasContainer}>
      {/* Canvas Top Bar & Channel Legend */}
      <div className={styles.canvasHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Synchronized Multi-Channel Telemetry Visualizer</span>
          <span className={styles.badge}>HTML5 CANVAS ENGINE</span>
        </div>

        <div className={styles.legendGroup}>
          <div className={styles.legendItem}>
            <span
              className={`${styles.legendDot} ${styles.lap1}`}
              style={session.driver1Meta?.teamColor ? { backgroundColor: session.driver1Meta.teamColor } : undefined}
            />
            <span>
              {session.driver1Meta
                ? `#${session.driver1Meta.driverNumber} ${session.driver1Meta.driverCode} (Ref)`
                : 'Lap 1 (Ref)'}
            </span>
          </div>
          <div className={styles.legendItem}>
            <span
              className={`${styles.legendDot} ${styles.lap2}`}
              style={session.driver2Meta?.teamColor ? { backgroundColor: session.driver2Meta.teamColor } : undefined}
            />
            <span>
              {session.driver2Meta
                ? `#${session.driver2Meta.driverNumber} ${session.driver2Meta.driverCode} (Tgt)`
                : 'Lap 2 (Tgt)'}
            </span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.throttle}`} />
            <span>Throttle</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.brake}`} />
            <span>Brake</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.delta}`} />
            <span>Delta Trace</span>
          </div>
        </div>
      </div>

      {/* Pure HTML5 Canvas Rendering Surface */}
      <div className={styles.canvasWrapper} ref={containerRef}>
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />
      </div>

      {/* Synchronized Real-time Inspection HUD Readout */}
      <div className={styles.hudDock}>
        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>TRACK POSITION</span>
          <span className={styles.hudValue}>{Math.round(activeDistance).toLocaleString()} m</span>
          <span className={styles.hudSubText}>of {totalTrackLength.toLocaleString()} m</span>
        </div>

        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>
            SPEED ({session.driver1Meta?.driverCode || 'REF'} vs {session.driver2Meta?.driverCode || 'TGT'})
          </span>
          <span className={styles.hudValue}>
            <span
              className={styles.refText}
              style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}
            >
              {hoveredPointRef?.speed.toFixed(1) ?? '—'}
            </span>
            {' / '}
            <span
              className={styles.compText}
              style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}
            >
              {hoveredPointComp?.speed.toFixed(1) ?? '—'}
            </span>
          </span>
          <span className={styles.hudSubText}>
            Δ {speedDelta > 0 ? `+${speedDelta.toFixed(1)}` : speedDelta.toFixed(1)} km/h
          </span>
        </div>

        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>PEDALS (THR / BRK)</span>
          <span className={styles.hudValue}>
            <span className={styles.throttleText}>
              {hoveredPointRef ? `${Math.round(hoveredPointRef.throttle * 100)}%` : '—'}
            </span>
            {' / '}
            <span className={styles.brakeText}>
              {hoveredPointRef ? `${Math.round(hoveredPointRef.brake * 100)}%` : '—'}
            </span>
          </span>
          <span className={styles.hudSubText}>Pressure input</span>
        </div>

        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>POWERTRAIN (GEAR / RPM)</span>
          <span className={styles.hudValue}>
            G{hoveredPointRef?.gear ?? 1} • {hoveredPointRef?.rpm.toLocaleString() ?? '—'}
          </span>
          <span className={styles.hudSubText}>6-speed sequential</span>
        </div>

        <div className={styles.hudCard}>
          <span className={styles.hudLabel}>
            DELTA TIME ({session.driver2Meta?.driverCode || 'LAP 2'})
          </span>
          <span
            className={`${styles.hudValue} ${
              (deltaAtHover ?? 0) > 0 ? styles.slower : styles.faster
            }`}
          >
            {deltaAtHover !== null
              ? `${deltaAtHover > 0 ? '+' : ''}${deltaAtHover.toFixed(3)}s`
              : '0.000s'}
          </span>
          <span className={styles.hudSubText}>
            {(deltaAtHover ?? 0) > 0
              ? `Trailing ${session.driver1Meta?.driverCode || 'reference'}`
              : `Ahead of ${session.driver1Meta?.driverCode || 'reference'}`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryCanvas;
