import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import styles from './GGCircle.module.scss';
import { useTelemetry } from '../../context/useTelemetry';

export const GGCircle: React.FC = () => {
  const { session, activeDistance, hoveredPointRef } = useTelemetry();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Collect the past 15 points along the reference lap leading up to activeDistance for fading trail
  const trailPoints = useMemo(() => {
    const lap = session.referenceLap;
    if (lap.length === 0) return [];

    let activeIdx = 0;
    for (let i = 0; i < lap.length; i++) {
      if (lap[i]!.distance <= activeDistance) {
        activeIdx = i;
      } else {
        break;
      }
    }

    const trailCount = 15;
    const startIdx = Math.max(0, activeIdx - trailCount);
    return lap.slice(startIdx, activeIdx + 1);
  }, [session.referenceLap, activeDistance]);

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

    // Clear background
    ctx.fillStyle = '#0e1219';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    // Map radius such that 2.5G fits nicely with padding
    const maxG = 2.6;
    const radiusScale = (Math.min(width, height) - 40) / (2 * maxG);

    // Map (gLat, gLong) to canvas coordinates:
    // X-axis: gLat (-2.5 to +2.5). Positive = right (+X), Negative = left (-X)
    // Y-axis: gLong (+1.2 to -2.0). Positive = accel (+Y up -> -Y in canvas), Negative = brake (-Y down -> +Y in canvas)
    const mapGToCanvas = (gLat: number, gLong: number): { x: number; y: number } => {
      const x = centerX + gLat * radiusScale;
      const y = centerY - gLong * radiusScale; // upward for positive acceleration, downward for braking
      return { x, y };
    };

    // 1. Draw Concentric Grip Rings (0.5G, 1.0G, 1.5G, 2.0G)
    const rings = [0.5, 1.0, 1.5, 2.0];
    rings.forEach((r) => {
      const rPx = r * radiusScale;
      ctx.beginPath();
      ctx.arc(centerX, centerY, rPx, 0, Math.PI * 2);

      if (r === 1.5 || r === 2.0) {
        // Outer tire grip threshold rings
        ctx.strokeStyle = r === 2.0 ? 'rgba(255, 56, 100, 0.45)' : 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = '#1b1f2b';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring label
      ctx.font = '8px "JetBrains Mono", Menlo, monospace';
      ctx.fillStyle = r === 2.0 ? '#ff3864' : '#484f58';
      ctx.textAlign = 'left';
      ctx.fillText(`${r.toFixed(1)}G`, centerX + 4, centerY - rPx + 10);
    });

    // 2. Crosshair Coordinate Axes
    ctx.strokeStyle = '#1b1f2b';
    ctx.lineWidth = 1;
    // Horizontal (gLat)
    ctx.beginPath();
    ctx.moveTo(16, centerY);
    ctx.lineTo(width - 16, centerY);
    ctx.stroke();

    // Vertical (gLong)
    ctx.beginPath();
    ctx.moveTo(centerX, 16);
    ctx.lineTo(centerX, height - 16);
    ctx.stroke();

    // Axis Labels
    ctx.font = '600 8.5px Inter, -apple-system, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.textAlign = 'center';
    ctx.fillText('ACCEL (+1.2G)', centerX, 14);
    ctx.fillText('BRAKE (-2.0G)', centerX, height - 6);

    ctx.textAlign = 'left';
    ctx.fillText('LEFT', 6, centerY - 4);
    ctx.textAlign = 'right';
    ctx.fillText('RIGHT', width - 6, centerY - 4);

    const activeColor = session.driver1Meta?.teamColor || '#00f0ff';

    // 3. Faint Fading Trail Effect of Past 15 Points (Visualizing Trail Braking Transition)
    if (trailPoints.length > 1) {
      for (let i = 0; i < trailPoints.length - 1; i++) {
        const pt1 = trailPoints[i]!;
        const pt2 = trailPoints[i + 1]!;
        const p1 = mapGToCanvas(pt1.gLat, pt1.gLong);
        const p2 = mapGToCanvas(pt2.gLat, pt2.gLong);

        const progress = (i + 1) / trailPoints.length; // 0 to 1
        const alpha = Math.max(0.08, progress * 0.7);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 1.8 * progress + 0.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Trail dot
        ctx.fillStyle = '#e0b0ff';
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 1.8 * progress, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 4. Active Friction G Point
    if (hoveredPointRef) {
      const activeCoord = mapGToCanvas(hoveredPointRef.gLat, hoveredPointRef.gLong);

      ctx.save();
      // Line vector connecting center (0,0) to active friction coordinate
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(activeCoord.x, activeCoord.y);
      ctx.stroke();

      // Outer pulsing halo
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(activeCoord.x, activeCoord.y, 9, 0, Math.PI * 2);
      ctx.fill();

      // Inner glowing core
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = activeColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(activeCoord.x, activeCoord.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [trailPoints, hoveredPointRef, session.driver1Meta]);

  // Responsive Resize Handling
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        render();
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  const currentGLat = hoveredPointRef?.gLat ?? 0;
  const currentGLong = hoveredPointRef?.gLong ?? 0;
  const totalG = Math.sqrt(currentGLat * currentGLat + currentGLong * currentGLong);

  return (
    <div className={styles.ggPanel}>
      <div className={styles.ggHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>
            G-G Friction Circle ({session.driver1Meta?.driverCode || 'REF'})
          </span>
          <span className={styles.badge}>TIRE ENVELOPE</span>
        </div>
        <span className={styles.readoutG}>
          COMBINED G: <span className={styles.totalG}>{totalG.toFixed(2)}G</span>
        </span>
      </div>

      <div className={styles.canvasWrapper} ref={containerRef}>
        <canvas ref={canvasRef} />
      </div>

      <div className={styles.ggFooter}>
        <div className={styles.metricItem}>
          <span>LONG G:</span>
          <span
            className={
              currentGLong < 0
                ? styles.valBrake
                : currentGLong > 0
                ? styles.valAccel
                : undefined
            }
          >
            {currentGLong > 0 ? `+${currentGLong.toFixed(2)}` : currentGLong.toFixed(2)}G
          </span>
        </div>

        <div className={styles.metricItem}>
          <span>LAT G:</span>
          <span className={styles.valLat}>
            {currentGLat > 0 ? `+${currentGLat.toFixed(2)}` : currentGLat.toFixed(2)}G
          </span>
        </div>

        <div className={styles.metricItem}>
          <span>GRIP LIMIT: 2.0G</span>
        </div>
      </div>
    </div>
  );
};

export default GGCircle;
