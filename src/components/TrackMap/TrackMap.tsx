import React, { useMemo, useCallback, useRef, useState } from 'react';
import styles from './TrackMap.module.scss';
import { useTelemetry } from '../../context/useTelemetry';
import {
  MONZA_WAYPOINTS,
  CORNER_ANNOTATIONS,
  getCoordinatesAtDistance,
  generateSvgPathString,
  findClosestTrackDistance,
} from '../../utils/trackGeometry';

interface HoverSnapIndicator {
  distance: number;
  x: number;
  y: number;
}

export const TrackMap: React.FC = () => {
  const { session, activeDistance, setActiveDistance, setIsHovering, hoveredPointRef, hoveredPointComp } =
    useTelemetry();

  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const [hoverSnap, setHoverSnap] = useState<HoverSnapIndicator | null>(null);

  const refColor = session.driver1Meta?.teamColor || '#00f0ff';
  const compColor = session.driver2Meta?.teamColor || '#ff3864';
  const refCode = session.driver1Meta?.driverCode || 'REF';
  const compCode = session.driver2Meta?.driverCode || 'TGT';
  const refNum = session.driver1Meta?.driverNumber ? `#${session.driver1Meta.driverNumber} ` : '';
  const compNum = session.driver2Meta?.driverNumber ? `#${session.driver2Meta.driverNumber} ` : '';

  // 1. Check if session.referenceLap contains valid (x, y) GPS coordinates
  const hasRealGps = useMemo(() => {
    const lap = session.referenceLap;
    if (!lap || lap.length < 10) return false;
    return lap.some(
      (pt) =>
        typeof pt.x === 'number' &&
        typeof pt.y === 'number' &&
        !isNaN(pt.x) &&
        !isNaN(pt.y) &&
        (pt.x !== 0 || pt.y !== 0)
    );
  }, [session.referenceLap]);

  // 2. Compute dynamic GPS bounding box (8% padding), viewBox, and SVG polylines
  const gpsCircuitData = useMemo(() => {
    if (!hasRealGps) return null;
    const lap = session.referenceLap;

    let rawMinX = Infinity;
    let rawMaxX = -Infinity;
    let rawMinY = Infinity;
    let rawMaxY = -Infinity;

    const rawGpsPts: Array<{ x: number; y: number; distance: number }> = [];

    for (const pt of lap) {
      if (typeof pt.x === 'number' && typeof pt.y === 'number' && !isNaN(pt.x) && !isNaN(pt.y)) {
        // Invert Y-axis so North/Up orientation matches standard circuit maps
        const normX = pt.x;
        const normY = -pt.y;
        rawGpsPts.push({ x: normX, y: normY, distance: pt.distance });
        if (normX < rawMinX) rawMinX = normX;
        if (normX > rawMaxX) rawMaxX = normX;
        if (normY < rawMinY) rawMinY = normY;
        if (normY > rawMaxY) rawMaxY = normY;
      }
    }

    if (rawGpsPts.length < 10) return null;

    const spanX = rawMaxX - rawMinX || 1;
    const spanY = rawMaxY - rawMinY || 1;
    const padX = spanX * 0.08;
    const padY = spanY * 0.08;

    const minX = rawMinX - padX;
    const maxX = rawMaxX + padX;
    const minY = rawMinY - padY;
    const maxY = rawMaxY + padY;
    const width = maxX - minX;
    const height = maxY - minY;

    const viewBox = `${minX.toFixed(1)} ${minY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
    const scaleRatio = width / 630;

    const s1Marker = session.sectors?.[0]?.distanceMarker ?? 1950;
    const s2Marker = session.sectors?.[1]?.distanceMarker ?? 4150;

    const s1Pts = rawGpsPts.filter((p) => p.distance <= s1Marker);
    const s2Pts = rawGpsPts.filter((p) => p.distance >= s1Marker && p.distance <= s2Marker);
    const s3Pts = rawGpsPts.filter((p) => p.distance >= s2Marker);

    const makeSvgPath = (points: typeof rawGpsPts) => {
      if (points.length === 0) return '';
      return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    };

    return {
      pts: rawGpsPts,
      fullPath: makeSvgPath(rawGpsPts),
      s1Path: makeSvgPath(s1Pts),
      s2Path: makeSvgPath(s2Pts),
      s3Path: makeSvgPath(s3Pts),
      viewBox,
      scaleRatio: Math.max(0.1, scaleRatio),
    };
  }, [hasRealGps, session.referenceLap, session.sectors]);

  // Fallback synthetic Monza path using MONZA_WAYPOINTS if real GPS coordinates are absent
  const syntheticPaths = useMemo(() => {
    const s1Pts = MONZA_WAYPOINTS.filter((p) => p.distance <= 1950);
    const s2Pts = MONZA_WAYPOINTS.filter((p) => p.distance >= 1950 && p.distance <= 4150);
    const s3Pts = MONZA_WAYPOINTS.filter((p) => p.distance >= 4150);

    return {
      s1Path: generateSvgPathString(s1Pts),
      s2Path: generateSvgPathString(s2Pts),
      s3Path: generateSvgPathString(s3Pts),
      fullPath: generateSvgPathString(MONZA_WAYPOINTS),
    };
  }, []);

  const activeFullPath = gpsCircuitData ? gpsCircuitData.fullPath : syntheticPaths.fullPath;
  const activeS1Path = gpsCircuitData ? gpsCircuitData.s1Path : syntheticPaths.s1Path;
  const activeS2Path = gpsCircuitData ? gpsCircuitData.s2Path : syntheticPaths.s2Path;
  const activeS3Path = gpsCircuitData ? gpsCircuitData.s3Path : syntheticPaths.s3Path;
  const activeViewBox = gpsCircuitData ? gpsCircuitData.viewBox : '160 50 630 470';
  const scale = gpsCircuitData ? gpsCircuitData.scaleRatio : 1;

  // Position interpolation helper for beacons
  const getPositionAtDist = useCallback(
    (dist: number) => {
      if (gpsCircuitData && gpsCircuitData.pts.length > 0) {
        const pts = gpsCircuitData.pts;
        if (dist <= pts[0]!.distance) return { x: pts[0]!.x, y: pts[0]!.y, heading: 0 };
        const last = pts[pts.length - 1]!;
        if (dist >= last.distance) return { x: last.x, y: last.y, heading: 0 };

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i]!;
          const p2 = pts[i + 1]!;
          if (dist >= p1.distance && dist <= p2.distance) {
            const span = p2.distance - p1.distance || 1;
            const t = (dist - p1.distance) / span;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;
            const heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            return { x, y, heading };
          }
        }
        return { x: last.x, y: last.y, heading: 0 };
      }
      return getCoordinatesAtDistance(dist);
    },
    [gpsCircuitData]
  );

  // Compute live coordinates and headings for car beacon markers
  const refPos = useMemo(() => {
    return getPositionAtDist(activeDistance);
  }, [activeDistance, getPositionAtDist]);

  const totalTrackDist = session.referenceLap?.[session.referenceLap.length - 1]?.distance ?? 5793;

  const compPos = useMemo(() => {
    if (!hoveredPointRef || !hoveredPointComp) return refPos;
    const deltaSec = hoveredPointComp.time - hoveredPointRef.time;
    const speedMs = (hoveredPointComp.speed * 1000) / 3600;
    const distanceOffsetMeters = -deltaSec * speedMs;
    const targetCompDist = Math.max(0, Math.min(totalTrackDist, activeDistance + distanceOffsetMeters));
    return getPositionAtDist(targetCompDist);
  }, [activeDistance, hoveredPointRef, hoveredPointComp, refPos, getPositionAtDist, totalTrackDist]);

  /**
   * Project mouse/touch client coordinates into exact SVG viewBox space using SVG DOM matrix inversion:
   * svg.getScreenCTM().inverse()
   */
  const getSvgCoordinates = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;

    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    const inv = ctm.inverse();
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(inv);
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // Find closest track distance helper (handles both real GPS polyline and synthetic Monza path)
  const findClosestDistance = useCallback(
    (targetX: number, targetY: number) => {
      if (gpsCircuitData && gpsCircuitData.pts.length > 0) {
        let closestDist = 0;
        let minSq = Infinity;
        let projX = targetX;
        let projY = targetY;

        for (const p of gpsCircuitData.pts) {
          const dx = p.x - targetX;
          const dy = p.y - targetY;
          const sq = dx * dx + dy * dy;
          if (sq < minSq) {
            minSq = sq;
            closestDist = p.distance;
            projX = p.x;
            projY = p.y;
          }
        }
        return { distance: closestDist, projX, projY };
      }
      return findClosestTrackDistance(targetX, targetY, MONZA_WAYPOINTS);
    },
    [gpsCircuitData]
  );

  // Click & Drag Scrubbing interaction on SVG track
  const handlePointerInteraction = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      if (!coords) return;

      const closest = findClosestDistance(coords.x, coords.y);
      setActiveDistance(closest.distance);
      setIsHovering(true);
      setHoverSnap({
        distance: closest.distance,
        x: closest.projX,
        y: closest.projY,
      });
    },
    [getSvgCoordinates, findClosestDistance, setActiveDistance, setIsHovering]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    handlePointerInteraction(e);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    if (coords) {
      const closest = findClosestDistance(coords.x, coords.y);
      setHoverSnap({
        distance: closest.distance,
        x: closest.projX,
        y: closest.projY,
      });
    }

    if (isDraggingRef.current || e.buttons === 1) {
      handlePointerInteraction(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const handlePointerLeave = () => {
    isDraggingRef.current = false;
    setHoverSnap(null);
  };

  return (
    <div className={styles.trackMapPanel}>
      <div className={styles.mapHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.mapTitle}>Circuit Geometry & Live Position</span>
          <div className={styles.liveBeaconTag}>
            <span className={styles.beaconPulse} />
            <span>{gpsCircuitData ? 'REAL GPS TRACK' : '2D GPS SYNC'}</span>
          </div>
        </div>

        <div className={styles.sectorLegend}>
          <div className={styles.sectorIndicator}>
            <span className={`${styles.secColorBox} ${styles.sec1}`} />
            <span>S1 ({session.sectors?.[0]?.distanceMarker ?? 1950}m)</span>
          </div>
          <div className={styles.sectorIndicator}>
            <span className={`${styles.secColorBox} ${styles.sec2}`} />
            <span>S2 ({session.sectors?.[1]?.distanceMarker ?? 4150}m)</span>
          </div>
          <div className={styles.sectorIndicator}>
            <span className={`${styles.secColorBox} ${styles.sec3}`} />
            <span>S3 ({session.sectors?.[2]?.distanceMarker ?? Math.round(totalTrackDist)}m)</span>
          </div>
        </div>
      </div>

      <div className={styles.svgWrapper}>
        <svg
          ref={svgRef}
          viewBox={activeViewBox}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Filter glow effects for car beacons */}
            <filter id="refGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation={3.5 * scale} floodColor={refColor} />
            </filter>
            <filter id="compGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation={3.5 * scale} floodColor={compColor} />
            </filter>
          </defs>

          {/* 1. Circuit Base Asphalt Outline */}
          <path
            d={activeFullPath}
            fill="none"
            stroke="#161b26"
            strokeWidth={20 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={activeFullPath}
            fill="none"
            stroke="#1e2433"
            strokeWidth={12 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Sector-colored racing line */}
          <path
            d={activeS1Path}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={3.5 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
          />
          <path
            d={activeS2Path}
            fill="none"
            stroke="#a855f7"
            strokeWidth={3.5 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
          />
          <path
            d={activeS3Path}
            fill="none"
            stroke="#34d399"
            strokeWidth={3.5 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
          />

          {/* Start/Finish gantry line (Synthetic Monza layout) */}
          {!gpsCircuitData && (
            <line
              x1="248"
              y1="440"
              x2="272"
              y2="440"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="2,2"
            />
          )}

          {/* 3. Corner Annotations (synthetic Monza) OR dynamic Sector split boundary dots (GPS tracks) */}
          {!gpsCircuitData ? (
            CORNER_ANNOTATIONS.map((corner) => (
              <g key={corner.number} transform={`translate(${corner.x}, ${corner.y})`}>
                <circle cx="0" cy="0" r="2.5" fill="#8492a6" opacity="0.6" />
                <text
                  x={corner.labelOffsetX}
                  y={corner.labelOffsetY}
                  className={styles.cornerText}
                >
                  {corner.name}
                </text>
                <text
                  x={corner.labelOffsetX}
                  y={corner.labelOffsetY - 8}
                  className={styles.cornerBadge}
                >
                  {corner.number}
                </text>
              </g>
            ))
          ) : (
            session.sectors.map((sec) => {
              const pos = getPositionAtDist(sec.distanceMarker);
              const label = sec.sectorIndex === 3 ? 'FINISH' : `S${sec.sectorIndex} SPLIT`;
              return (
                <g key={sec.sectorIndex} transform={`translate(${pos.x}, ${pos.y})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r={3.5 * scale}
                    fill="#ffffff"
                    stroke="#0a0c10"
                    strokeWidth={1.2 * scale}
                  />
                  <text
                    x={6 * scale}
                    y={-4 * scale}
                    fill="#94a3b8"
                    fontSize={8 * scale}
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="700"
                  >
                    {label}
                  </text>
                </g>
              );
            })
          )}

          {/* 4. Visible Hover Target Crosshair Indicator on Track Line */}
          {hoverSnap && (
            <g transform={`translate(${hoverSnap.x}, ${hoverSnap.y})`}>
              <circle
                cx="0"
                cy="0"
                r={7 * scale}
                fill="none"
                stroke="rgba(255, 255, 255, 0.75)"
                strokeWidth={1.2 * scale}
                strokeDasharray={`${2 * scale},${2 * scale}`}
              />
              <circle
                cx="0"
                cy="0"
                r={2.5 * scale}
                fill="#ffffff"
              />
            </g>
          )}

          {/* 5. Target Lap 2 Car Marker Beacon */}
          <g transform={`translate(${compPos.x}, ${compPos.y})`}>
            <line
              x1="0"
              y1="0"
              x2={Math.cos(compPos.heading) * 12 * scale}
              y2={Math.sin(compPos.heading) * 12 * scale}
              stroke={compColor}
              strokeWidth={2 * scale}
              strokeLinecap="round"
            />
            <circle
              cx="0"
              cy="0"
              r={5.5 * scale}
              fill={compColor}
              stroke="#ffffff"
              strokeWidth={1.2 * scale}
              filter="url(#compGlow)"
            />
            <text
              x={Math.cos(compPos.heading + Math.PI / 2) * 14 * scale}
              y={Math.sin(compPos.heading + Math.PI / 2) * 14 * scale}
              fill={compColor}
              fontSize={9 * scale}
              fontWeight="700"
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="middle"
            >
              {compCode}
            </text>
          </g>

          {/* 6. Reference Lap 1 Car Marker Beacon */}
          <g transform={`translate(${refPos.x}, ${refPos.y})`}>
            <line
              x1="0"
              y1="0"
              x2={Math.cos(refPos.heading) * 14 * scale}
              y2={Math.sin(refPos.heading) * 14 * scale}
              stroke={refColor}
              strokeWidth={2 * scale}
              strokeLinecap="round"
            />
            <circle
              cx="0"
              cy="0"
              r={6 * scale}
              fill={refColor}
              stroke="#ffffff"
              strokeWidth={1.5 * scale}
              filter="url(#refGlow)"
            />
            <text
              x={Math.cos(refPos.heading - Math.PI / 2) * 14 * scale}
              y={Math.sin(refPos.heading - Math.PI / 2) * 14 * scale}
              fill={refColor}
              fontSize={9 * scale}
              fontWeight="700"
              fontFamily="'JetBrains Mono', monospace"
              textAnchor="middle"
            >
              {refCode}
            </text>
          </g>
        </svg>
      </div>

      <div className={styles.mapFooter}>
        <div className={styles.footerMetric}>
          <span>{refNum}{refCode} (REF):</span>
          <span className={styles.refPoint} style={{ color: refColor }}>{Math.round(activeDistance)}m</span>
        </div>
        <div className={styles.footerMetric}>
          <span>
            {hoverSnap
              ? `SNAP: ${Math.round(hoverSnap.distance)}m (CLICK TO SEEK)`
              : 'CLICK CIRCUIT TO SCRUB TELEMETRY'}
          </span>
        </div>
        <div className={styles.footerMetric}>
          <span>{compNum}{compCode} (TGT):</span>
          <span className={styles.tgtPoint} style={{ color: compColor }}>
            {hoveredPointComp ? `${hoveredPointComp.speed.toFixed(1)} km/h` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TrackMap;
