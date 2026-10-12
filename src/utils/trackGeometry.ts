export interface TrackWayPoint {
  distance: number; // cumulative distance in meters along racing line (0 to 5793m)
  x: number;        // layout coordinate x
  y: number;        // layout coordinate y
  label?: string;   // optional turn / sector name
}

export interface CornerAnnotation {
  number: string;
  name: string;
  distance: number;
  x: number;
  y: number;
  labelOffsetX: number;
  labelOffsetY: number;
}

export const TOTAL_MONZA_LENGTH = 5793;

/**
 * Authentic Monza Circuit Layout (5,793m)
 * Standard SVG viewbox coordinates (width: 800, height: 520)
 * Scaled and geometrically aligned to the authentic Monza track outline.
 */
export const MONZA_WAYPOINTS: TrackWayPoint[] = [
  // Pit Straight (Rettifilo Tribune): Heading roughly North (straight)
  { distance: 0, x: 230, y: 460, label: 'Start / Finish' },
  { distance: 350, x: 230, y: 350 },
  { distance: 750, x: 230, y: 220 },
  { distance: 1150, x: 230, y: 100, label: 'Braking T1' },

  // Variante del Rettifilo (T1 - T2 Chicane): Heavy threshold braking zone, sharp right then sharp left
  { distance: 1250, x: 235, y: 70 },
  { distance: 1330, x: 250, y: 55, label: 'Prima Variante T1' },
  { distance: 1420, x: 270, y: 75, label: 'Prima Variante T2' },
  { distance: 1520, x: 295, y: 100 },

  // Curva Grande (Biassono, T3): High-speed flat-out right sweep
  { distance: 1750, x: 350, y: 130 },
  { distance: 1950, x: 410, y: 150, label: 'Sector 1 Split' },
  { distance: 2150, x: 475, y: 155, label: 'Curva Grande T3' },
  { distance: 2400, x: 540, y: 135 },
  { distance: 2600, x: 580, y: 105 },

  // Variante della Roggia (T4 - T5 Chicane): Hard braking left-right chicane
  { distance: 2750, x: 605, y: 75, label: 'Variante della Roggia T4' },
  { distance: 2880, x: 630, y: 70, label: 'Variante della Roggia T5' },
  { distance: 3000, x: 660, y: 90 },

  // Curve di Lesmo 1 & Lesmo 2 (T6 - T7): Consecutive medium-speed rights
  { distance: 3180, x: 700, y: 125, label: 'Lesmo 1 T6' },
  { distance: 3380, x: 735, y: 175 },
  { distance: 3580, x: 745, y: 230, label: 'Lesmo 2 T7' },
  { distance: 3750, x: 730, y: 280 },

  // Curva del Serraglio kink & underpass straight
  { distance: 3950, x: 700, y: 325, label: 'Curva del Serraglio' },
  { distance: 4150, x: 665, y: 360, label: 'Sector 2 Split' },
  { distance: 4350, x: 620, y: 390 },

  // Variante Ascari (T8 - T10): High-commitment left-right-left chicane
  { distance: 4500, x: 575, y: 410, label: 'Variante Ascari T8' },
  { distance: 4650, x: 530, y: 420, label: 'Variante Ascari T9' },
  { distance: 4800, x: 475, y: 415, label: 'Variante Ascari T10' },

  // Rettifilo di Rialto back straight
  { distance: 5000, x: 420, y: 425 },
  { distance: 5200, x: 350, y: 445 },

  // Curva Parabolica / Alboreto (T11): Long progressive opening-radius sweeper onto main straight
  { distance: 5380, x: 285, y: 475, label: 'Parabolica Entry' },
  { distance: 5550, x: 230, y: 495, label: 'Curva Parabolica / Alboreto T11' },
  { distance: 5680, x: 200, y: 485 },
  { distance: 5793, x: 230, y: 460, label: 'Finish Line' },
];

export const CORNER_ANNOTATIONS: CornerAnnotation[] = [
  {
    number: 'T1-T2',
    name: 'Variante del Rettifilo',
    distance: 1330,
    x: 250,
    y: 55,
    labelOffsetX: -30,
    labelOffsetY: -18,
  },
  {
    number: 'T3',
    name: 'Curva Grande',
    distance: 2150,
    x: 475,
    y: 155,
    labelOffsetX: 0,
    labelOffsetY: 26,
  },
  {
    number: 'T4-T5',
    name: 'Variante della Roggia',
    distance: 2750,
    x: 605,
    y: 75,
    labelOffsetX: 10,
    labelOffsetY: -20,
  },
  {
    number: 'T6',
    name: 'Curve di Lesmo 1',
    distance: 3180,
    x: 700,
    y: 125,
    labelOffsetX: 22,
    labelOffsetY: -10,
  },
  {
    number: 'T7',
    name: 'Curve di Lesmo 2',
    distance: 3580,
    x: 745,
    y: 230,
    labelOffsetX: 25,
    labelOffsetY: 4,
  },
  {
    number: 'Kink',
    name: 'Curva del Serraglio',
    distance: 3950,
    x: 700,
    y: 325,
    labelOffsetX: 25,
    labelOffsetY: 10,
  },
  {
    number: 'T8-T10',
    name: 'Variante Ascari',
    distance: 4650,
    x: 530,
    y: 420,
    labelOffsetX: -20,
    labelOffsetY: 26,
  },
  {
    number: 'T11',
    name: 'Curva Parabolica / Alboreto',
    distance: 5550,
    x: 230,
    y: 495,
    labelOffsetX: -70,
    labelOffsetY: 24,
  },
];

export interface TrackCoord {
  x: number;
  y: number;
  heading: number; // angle in radians
}

/**
 * Linearly interpolate coordinate and compute tangential heading angle along circuit at distance `d`
 */
export function getCoordinatesAtDistance(distance: number): TrackCoord {
  const d = Math.max(0, Math.min(TOTAL_MONZA_LENGTH, distance));
  const wps = MONZA_WAYPOINTS;

  if (d <= wps[0]!.distance) {
    const p1 = wps[0]!;
    const p2 = wps[1]!;
    const heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return { x: p1.x, y: p1.y, heading };
  }

  const last = wps[wps.length - 1]!;
  if (d >= last.distance) {
    const p1 = wps[wps.length - 2]!;
    const p2 = last;
    const heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return { x: last.x, y: last.y, heading };
  }

  // Find surrounding segment
  for (let i = 0; i < wps.length - 1; i++) {
    const p1 = wps[i]!;
    const p2 = wps[i + 1]!;
    if (d >= p1.distance && d <= p2.distance) {
      const span = p2.distance - p1.distance || 1;
      const factor = (d - p1.distance) / span;
      const x = p1.x + (p2.x - p1.x) * factor;
      const y = p1.y + (p2.y - p1.y) * factor;
      const heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      return { x, y, heading };
    }
  }

  return { x: wps[0]!.x, y: wps[0]!.y, heading: 0 };
}

/**
 * Generate smooth SVG path d attribute from waypoint array or distance slices
 */
export function generateSvgPathString(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');
}

export interface SampledTrackPoint {
  distance: number;
  x: number;
  y: number;
  sector: 1 | 2 | 3;
}

export function sampleCircuitGeometry(stepMeters = 5): SampledTrackPoint[] {
  const points: SampledTrackPoint[] = [];
  const total = TOTAL_MONZA_LENGTH;

  for (let d = 0; d <= total; d += stepMeters) {
    const coord = getCoordinatesAtDistance(d);
    const sector: 1 | 2 | 3 = d < 1950 ? 1 : d < 4150 ? 2 : 3;
    points.push({
      distance: d,
      x: Math.round(coord.x * 10) / 10,
      y: Math.round(coord.y * 10) / 10,
      sector,
    });
  }

  const last = points[points.length - 1]!;
  if (last.distance < total) {
    const coord = getCoordinatesAtDistance(total);
    points.push({
      distance: total,
      x: Math.round(coord.x * 10) / 10,
      y: Math.round(coord.y * 10) / 10,
      sector: 3,
    });
  }

  return points;
}

export const DENSE_CIRCUIT_PATH = sampleCircuitGeometry(5);

function projectPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  distA: number,
  distB: number
): { distanceMeters: number; distSq: number; projX: number; projY: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const dpx = px - ax;
    const dpy = py - ay;
    return { distanceMeters: distA, distSq: dpx * dpx + dpy * dpy, projX: ax, projY: ay };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  const dpx = px - projX;
  const dpy = py - projY;
  const distSq = dpx * dpx + dpy * dpy;
  const distanceMeters = distA + t * (distB - distA);

  return { distanceMeters, distSq, projX, projY };
}

export function findClosestTrackDistance(
  targetX: number,
  targetY: number,
  samples: Array<{ distance: number; x: number; y: number }> = MONZA_WAYPOINTS
): { distance: number; projX: number; projY: number; distSq: number } {
  let closestDist = 0;
  let minDistanceSquared = Infinity;
  let bestProjX = 0;
  let bestProjY = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const p1 = samples[i]!;
    const p2 = samples[i + 1]!;
    const res = projectPointToSegment(
      targetX,
      targetY,
      p1.x,
      p1.y,
      p2.x,
      p2.y,
      p1.distance,
      p2.distance
    );

    if (res.distSq < minDistanceSquared) {
      minDistanceSquared = res.distSq;
      closestDist = res.distanceMeters;
      bestProjX = res.projX;
      bestProjY = res.projY;
    }
  }

  return {
    distance: Math.round(closestDist * 10) / 10,
    projX: bestProjX,
    projY: bestProjY,
    distSq: minDistanceSquared,
  };
}
