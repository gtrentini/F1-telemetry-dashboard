import type { TelemetryPoint, TelemetrySession, SectorSplit } from '../types/telemetry';

export interface ParseResult {
  session: TelemetrySession | null;
  error?: string;
}

/**
 * Calculates Sector 1, 2, and 3 split markers from normalized points
 */
function calculateSectorsFromPoints(
  refLap: TelemetryPoint[],
  compLap: TelemetryPoint[],
  totalDist: number
): SectorSplit[] {
  const s1Marker = Math.round(totalDist * 0.337);
  const s2Marker = Math.round(totalDist * 0.716);

  function getTimeAtDistance(lap: TelemetryPoint[], targetDist: number): number {
    for (let i = 0; i < lap.length - 1; i++) {
      const p1 = lap[i]!;
      const p2 = lap[i + 1]!;
      if (targetDist >= p1.distance && targetDist <= p2.distance) {
        const factor = (targetDist - p1.distance) / (p2.distance - p1.distance || 1);
        return p1.time + factor * (p2.time - p1.time);
      }
    }
    return lap[lap.length - 1]?.time ?? 0;
  }

  const s1Ref = getTimeAtDistance(refLap, s1Marker);
  const s1Comp = getTimeAtDistance(compLap, s1Marker);

  const s2Ref = getTimeAtDistance(refLap, s2Marker);
  const s2Comp = getTimeAtDistance(compLap, s2Marker);

  const s3Ref = refLap[refLap.length - 1]?.time ?? 0;
  const s3Comp = compLap[compLap.length - 1]?.time ?? 0;

  return [
    {
      sectorIndex: 1,
      distanceMarker: s1Marker,
      splitTimeLap1: Math.round(s1Ref * 1000) / 1000,
      splitTimeLap2: Math.round(s1Comp * 1000) / 1000,
      deltaSeconds: Math.round((s1Comp - s1Ref) * 1000) / 1000,
    },
    {
      sectorIndex: 2,
      distanceMarker: s2Marker,
      splitTimeLap1: Math.round(s2Ref * 1000) / 1000,
      splitTimeLap2: Math.round(s2Comp * 1000) / 1000,
      deltaSeconds: Math.round((s2Comp - s2Ref) * 1000) / 1000,
    },
    {
      sectorIndex: 3,
      distanceMarker: totalDist,
      splitTimeLap1: Math.round(s3Ref * 1000) / 1000,
      splitTimeLap2: Math.round(s3Comp * 1000) / 1000,
      deltaSeconds: Math.round((s3Comp - s3Ref) * 1000) / 1000,
    },
  ];
}

/**
 * Resamples a sequence of raw telemetry points onto a uniform distance axis
 */
export function resampleToUniformGrid(
  rawPoints: TelemetryPoint[],
  targetPointsCount = 460
): TelemetryPoint[] {
  if (rawPoints.length === 0) return [];
  const maxDist = rawPoints[rawPoints.length - 1]!.distance;
  const step = maxDist / (targetPointsCount - 1);
  const resampled: TelemetryPoint[] = [];

  let rawIdx = 0;
  for (let i = 0; i < targetPointsCount; i++) {
    const targetDist = i * step;

    while (rawIdx < rawPoints.length - 2 && rawPoints[rawIdx + 1]!.distance < targetDist) {
      rawIdx++;
    }

    const p1 = rawPoints[rawIdx]!;
    const p2 = rawPoints[rawIdx + 1] ?? p1;

    const span = p2.distance - p1.distance;
    const factor = span > 0 ? Math.max(0, Math.min(1, (targetDist - p1.distance) / span)) : 0;

    resampled.push({
      distance: Math.round(targetDist * 10) / 10,
      time: Math.round((p1.time + (p2.time - p1.time) * factor) * 1000) / 1000,
      speed: Math.round((p1.speed + (p2.speed - p1.speed) * factor) * 10) / 10,
      throttle: Math.round((p1.throttle + (p2.throttle - p1.throttle) * factor) * 100) / 100,
      brake: Math.round((p1.brake + (p2.brake - p1.brake) * factor) * 100) / 100,
      gear: factor < 0.5 ? p1.gear : p2.gear,
      rpm: Math.round(p1.rpm + (p2.rpm - p1.rpm) * factor),
      steeringAngle: Math.round((p1.steeringAngle + (p2.steeringAngle - p1.steeringAngle) * factor) * 10) / 10,
      gLat: Math.round((p1.gLat + (p2.gLat - p1.gLat) * factor) * 100) / 100,
      gLong: Math.round((p1.gLong + (p2.gLong - p1.gLong) * factor) * 100) / 100,
    });
  }

  return resampled;
}

/**
 * Parses raw JSON or CSV text into a validated TelemetrySession
 */
export function parseTelemetryData(rawContent: string, fileName = 'custom_telemetry'): ParseResult {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return { session: null, error: 'Empty file contents' };
  }

  // 1. JSON Parsing Attempt
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);

      // Direct TelemetrySession object
      if (parsed.referenceLap && Array.isArray(parsed.referenceLap)) {
        const session: TelemetrySession = {
          id: parsed.id || 'custom-upload',
          name: parsed.name || fileName.replace(/\.[^/.]+$/, ''),
          car: parsed.car || parsed.carName || 'Custom Vehicle',
          track: parsed.track || parsed.trackName || 'Autodromo Nazionale Monza - 5.793km',
          trackName: parsed.trackName || parsed.track || 'Autodromo Nazionale Monza - 5.793km',
          carName: parsed.carName || parsed.car || 'Custom Vehicle',
          isRealData: parsed.isRealData ?? true,
          refDriver: parsed.refDriver || 'Lap 1 (Ref)',
          compDriver: parsed.compDriver || 'Lap 2 (Tgt)',
          refLapTime: parsed.refLapTime,
          compLapTime: parsed.compLapTime,
          referenceLap: parsed.referenceLap,
          comparisonLap: parsed.comparisonLap || parsed.referenceLap,
          sectors:
            parsed.sectors ||
            calculateSectorsFromPoints(
              parsed.referenceLap,
              parsed.comparisonLap || parsed.referenceLap,
              parsed.referenceLap[parsed.referenceLap.length - 1]?.distance ?? 5793
            ),
        };
        return { session };
      }

      // Raw array of telemetry points
      if (Array.isArray(parsed) && parsed.length > 0) {
        const refLap = resampleToUniformGrid(parsed);
        const compLap = refLap;
        const totalDist = refLap[refLap.length - 1]?.distance ?? 5793;

        const session: TelemetrySession = {
          id: 'custom-upload',
          name: fileName.replace(/\.[^/.]+$/, ''),
          car: 'Imported Telemetry',
          track: 'Autodromo Nazionale Monza - 5.793km',
          trackName: 'Autodromo Nazionale Monza - 5.793km',
          carName: 'Imported Telemetry',
          isRealData: true,
          referenceLap: refLap,
          comparisonLap: compLap,
          sectors: calculateSectorsFromPoints(refLap, compLap, totalDist),
        };
        return { session };
      }
    } catch (err) {
      return { session: null, error: `Invalid JSON format: ${(err as Error).message}` };
    }
  }

  // 2. CSV Parsing Attempt
  try {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { session: null, error: 'CSV file contains insufficient rows' };
    }

    const headerLine = lines[0]!.toLowerCase();
    const headers = headerLine.split(/[,;\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ''));

    const distIdx = headers.findIndex((h) => h.includes('dist') || h === 'd' || h === 'meters');
    const timeIdx = headers.findIndex((h) => h.includes('time') || h === 't' || h === 'seconds');
    const speedIdx = headers.findIndex((h) => h.includes('speed') || h.includes('spd') || h === 'v');
    const throttleIdx = headers.findIndex((h) => h.includes('throttle') || h.includes('thr') || h === 'tps');
    const brakeIdx = headers.findIndex((h) => h.includes('brake') || h.includes('brk') || h === 'bp');
    const gearIdx = headers.findIndex((h) => h.includes('gear') || h === 'g');
    const rpmIdx = headers.findIndex((h) => h.includes('rpm') || h.includes('engine'));

    if (distIdx === -1 && timeIdx === -1) {
      return { session: null, error: 'CSV must contain at least a distance or time channel' };
    }

    const points: TelemetryPoint[] = [];
    let curDist = 0;
    let curTime = 0;
    let prevSpeed = 100;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i]!.split(/[,;\t]/).map((p) => p.trim());
      if (parts.length < headers.length) continue;

      const rawDist = distIdx !== -1 ? parseFloat(parts[distIdx]!) : NaN;
      const rawTime = timeIdx !== -1 ? parseFloat(parts[timeIdx]!) : NaN;
      const speed = speedIdx !== -1 ? parseFloat(parts[speedIdx]!) : 150;
      let throttle = throttleIdx !== -1 ? parseFloat(parts[throttleIdx]!) : 1.0;
      let brake = brakeIdx !== -1 ? parseFloat(parts[brakeIdx]!) : 0.0;
      const gear = gearIdx !== -1 ? parseInt(parts[gearIdx]!, 10) : 4;
      const rpm = rpmIdx !== -1 ? parseInt(parts[rpmIdx]!, 10) : 5500;

      // Normalize 0-100 to 0.0-1.0 if needed
      if (throttle > 1.0) throttle = throttle / 100;
      if (brake > 1.0) brake = brake / 100;

      if (!isNaN(rawDist)) {
        curDist = rawDist;
      } else if (!isNaN(rawTime)) {
        if (points.length > 0) {
          const dt = rawTime - curTime;
          const avgSpdMs = ((prevSpeed + speed) / 2 * 1000) / 3600;
          curDist += avgSpdMs * dt;
        }
        curTime = rawTime;
      }

      points.push({
        distance: Math.round(curDist * 10) / 10,
        time: isNaN(rawTime) ? Math.round(curTime * 1000) / 1000 : rawTime,
        speed: isNaN(speed) ? 100 : speed,
        throttle: isNaN(throttle) ? 1.0 : throttle,
        brake: isNaN(brake) ? 0.0 : brake,
        gear: isNaN(gear) ? 4 : gear,
        rpm: isNaN(rpm) ? 5500 : rpm,
        steeringAngle: 0,
        gLat: 0,
        gLong: 0,
      });

      prevSpeed = speed;
    }

    if (points.length === 0) {
      return { session: null, error: 'Could not extract valid telemetry data points' };
    }

    const refLap = resampleToUniformGrid(points);
    const compLap = refLap;
    const totalDist = refLap[refLap.length - 1]?.distance ?? 5793;

    const session: TelemetrySession = {
      id: 'custom-upload',
      name: fileName.replace(/\.[^/.]+$/, ''),
      car: 'CSV Imported Vehicle',
      track: 'Autodromo Nazionale Monza - 5.793km',
      trackName: 'Autodromo Nazionale Monza - 5.793km',
      carName: 'CSV Imported Vehicle',
      isRealData: true,
      referenceLap: refLap,
      comparisonLap: compLap,
      sectors: calculateSectorsFromPoints(refLap, compLap, totalDist),
    };

    return { session };
  } catch (err) {
    return { session: null, error: `CSV Parsing error: ${(err as Error).message}` };
  }
}
