import type { TelemetryPoint, SectorSplit, TelemetrySession } from '../types/telemetry';

export interface CircuitSegment {
  name: string;
  startDistance: number;
  endDistance: number;
  type: 'straight' | 'corner';
  apexDistance?: number;
  minSpeedLap1?: number; // target apex speed km/h
  minSpeedLap2?: number;
  maxSpeedLap1?: number; // top speed at end of straight km/h
  maxSpeedLap2?: number;
  gearLap1?: number;
  gearLap2?: number;
  steeringMax?: number; // peak steering angle in degrees (positive = right, negative = left)
  gLatPeak?: number; // peak lateral acceleration
}

export const MONZA_CIRCUIT_CONFIG: {
  totalLength: number;
  sectorMarkers: [number, number]; // End of S1, End of S2 in meters
  segments: CircuitSegment[];
} = {
  totalLength: 5793,
  sectorMarkers: [1950, 4150],
  segments: [
    {
      // 1. Pit Straight: Heavy acceleration up to ~340 km/h threshold braking
      name: 'Rettifilo Tribune (Pit Straight)',
      startDistance: 0,
      endDistance: 1150,
      type: 'straight',
      maxSpeedLap1: 342,
      maxSpeedLap2: 340,
    },
    {
      // 2. Variante del Rettifilo (T1-T2 Chicane): Extreme threshold braking from ~340 down to ~75 km/h
      name: 'Variante del Rettifilo (T1/T2 Chicanes)',
      startDistance: 1150,
      endDistance: 1550,
      type: 'corner',
      apexDistance: 1330,
      minSpeedLap1: 76,
      minSpeedLap2: 72, // Lap 2 earlier braking, losing ~0.18s
      gearLap1: 1,
      gearLap2: 1,
      steeringMax: 120,
      gLatPeak: 2.1,
    },
    {
      // 3. Curva Grande (Biassono, T3): Flat-out high-speed right sweep
      name: 'Curva Grande (Biassono T3)',
      startDistance: 1550,
      endDistance: 2600,
      type: 'corner',
      apexDistance: 2150,
      minSpeedLap1: 285,
      minSpeedLap2: 290, // Lap 2 higher apex speed (+0.09s gained back)
      gearLap1: 6,
      gearLap2: 6,
      steeringMax: 26,
      gLatPeak: 2.4,
    },
    {
      // 4. Variante della Roggia (T4-T5 Chicane): Heavy braking from ~325 km/h to ~115 km/h
      name: 'Variante della Roggia (T4/T5)',
      startDistance: 2600,
      endDistance: 3000,
      type: 'corner',
      apexDistance: 2820,
      minSpeedLap1: 118,
      minSpeedLap2: 116,
      gearLap1: 2,
      gearLap2: 2,
      steeringMax: -115,
      gLatPeak: -2.1,
    },
    {
      // 5. Curve di Lesmo 1 (T6): Fast medium-speed right hander
      name: 'Curve di Lesmo 1 (T6)',
      startDistance: 3000,
      endDistance: 3380,
      type: 'corner',
      apexDistance: 3180,
      minSpeedLap1: 178,
      minSpeedLap2: 176,
      gearLap1: 3,
      gearLap2: 3,
      steeringMax: 65,
      gLatPeak: 2.2,
    },
    {
      // 6. Curve di Lesmo 2 (T7): Fast 90-degree right hander onto back straight
      name: 'Curve di Lesmo 2 (T7)',
      startDistance: 3380,
      endDistance: 3750,
      type: 'corner',
      apexDistance: 3580,
      minSpeedLap1: 165,
      minSpeedLap2: 164,
      gearLap1: 3,
      gearLap2: 3,
      steeringMax: 72,
      gLatPeak: 2.3,
    },
    {
      // 7. Curva del Serraglio kink & underpass straight
      name: 'Curva del Serraglio & Straight',
      startDistance: 3750,
      endDistance: 4400,
      type: 'straight',
      maxSpeedLap1: 335,
      maxSpeedLap2: 334,
    },
    {
      // 8. Variante Ascari (T8-T10 Chicane): High-commitment left-right-left chicane
      name: 'Variante Ascari (T8/T9/T10)',
      startDistance: 4400,
      endDistance: 4950,
      type: 'corner',
      apexDistance: 4680,
      minSpeedLap1: 205,
      minSpeedLap2: 203,
      gearLap1: 4,
      gearLap2: 4,
      steeringMax: -85,
      gLatPeak: -2.35,
    },
    {
      // 9. Rettifilo di Rialto back straight
      name: 'Rettifilo di Rialto',
      startDistance: 4950,
      endDistance: 5350,
      type: 'straight',
      maxSpeedLap1: 332,
      maxSpeedLap2: 331,
    },
    {
      // 10. Curva Parabolica / Alboreto (T11): High-speed long opening-radius sweeper
      name: 'Curva Parabolica / Alboreto (T11)',
      startDistance: 5350,
      endDistance: 5793,
      type: 'corner',
      apexDistance: 5580,
      minSpeedLap1: 215,
      minSpeedLap2: 214,
      gearLap1: 4,
      gearLap2: 4,
      steeringMax: 56,
      gLatPeak: 2.4,
    },
  ],
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function calculateGearAndRPM(speedKmh: number): { gear: number; rpm: number } {
  let gear = 1;
  let rpm = 4000;

  if (speedKmh < 95) {
    gear = 1;
    rpm = 3800 + ((speedKmh - 50) / 45) * 3800;
  } else if (speedKmh < 145) {
    gear = 2;
    rpm = 4200 + ((speedKmh - 95) / 50) * 3600;
  } else if (speedKmh < 195) {
    gear = 3;
    rpm = 4500 + ((speedKmh - 145) / 50) * 3400;
  } else if (speedKmh < 245) {
    gear = 4;
    rpm = 4900 + ((speedKmh - 195) / 50) * 3200;
  } else if (speedKmh < 295) {
    gear = 5;
    rpm = 5300 + ((speedKmh - 245) / 50) * 2900;
  } else {
    gear = 6;
    rpm = 5700 + ((speedKmh - 295) / 55) * 2500;
  }

  return {
    gear: clamp(gear, 1, 6),
    rpm: Math.round(clamp(rpm, 3500, 8200)),
  };
}

function evaluateCircuitPoint(d: number, isReferenceLap: boolean): {
  speed: number;
  throttle: number;
  brake: number;
  steeringAngle: number;
  gLat: number;
} {
  const segments = MONZA_CIRCUIT_CONFIG.segments;
  let currentSegment = segments[0]!;

  for (const seg of segments) {
    if (d >= seg.startDistance && d <= seg.endDistance) {
      currentSegment = seg;
      break;
    }
  }

  const { startDistance, endDistance, type } = currentSegment;
  const segLength = endDistance - startDistance;
  const localProg = (d - startDistance) / (segLength || 1);

  let speed = 250;
  let throttle = 1.0;
  let brake = 0.0;
  let steeringAngle = 0;
  let gLat = 0;

  if (type === 'straight') {
    const maxSpeed = isReferenceLap
      ? (currentSegment.maxSpeedLap1 ?? 335)
      : (currentSegment.maxSpeedLap2 ?? 334);
    
    const entrySpeed = 215;
    const accelProfile = Math.sqrt(Math.max(0, localProg));
    speed = entrySpeed + (maxSpeed - entrySpeed) * accelProfile;
    throttle = 1.0;
    brake = 0.0;
    steeringAngle = Math.sin(d * 0.03) * 0.35;
    gLat = steeringAngle * 0.03;
  } else {
    // Corner
    const apexDist = currentSegment.apexDistance ?? (startDistance + segLength * 0.5);
    const minApexSpeed = isReferenceLap
      ? (currentSegment.minSpeedLap1 ?? 120)
      : (currentSegment.minSpeedLap2 ?? 118);
    const entrySpeed = 335;
    const exitSpeed = minApexSpeed + 80;

    const isTurn1 = currentSegment.name.includes('Variante del Rettifilo');
    const isCurvaGrande = currentSegment.name.includes('Curva Grande');

    let effectiveBrakeProg = (d - startDistance) / (apexDist - startDistance || 1);

    if (!isReferenceLap && isTurn1) {
      // Lap 2 brakes earlier into Turn 1, losing ~0.18s
      effectiveBrakeProg = Math.min(1.0, Math.pow(effectiveBrakeProg, 0.92));
    }

    if (d < apexDist) {
      // Trail-braking deceleration phase: heavy initial brake bleed down into turn-in
      speed = entrySpeed - (entrySpeed - minApexSpeed) * Math.sin((effectiveBrakeProg * Math.PI) / 2);

      if (effectiveBrakeProg < 0.60) {
        brake = clamp(0.98 - effectiveBrakeProg * 0.35, 0.2, 1.0);
        throttle = 0.0;
      } else {
        // Trail-braking: bleeding off brake pressure while applying steering lock
        brake = clamp((1 - effectiveBrakeProg) * 0.65, 0.0, 0.6);
        throttle = 0.05;
      }

      const steerPeak = currentSegment.steeringMax ?? 60;
      steeringAngle = steerPeak * Math.sin((effectiveBrakeProg * Math.PI) / 2);
    } else {
      // Corner exit phase: Unwinding steering while feeding in throttle
      const exitProg = (d - apexDist) / (endDistance - apexDist || 1);
      let exitApexSpeed = minApexSpeed;

      if (!isReferenceLap && isCurvaGrande) {
        exitApexSpeed += 3.5; // sustains higher apex speed (+0.09s gained back)
      }

      speed = exitApexSpeed + (exitSpeed - exitApexSpeed) * Math.pow(exitProg, 0.82);

      brake = 0.0;
      throttle = clamp(0.35 + exitProg * 0.65, 0.0, 1.0);

      const steerPeak = currentSegment.steeringMax ?? 60;
      steeringAngle = steerPeak * (1 - Math.pow(exitProg, 1.25));
    }

    const gLatPeak = currentSegment.gLatPeak ?? 2.0;
    const normAngle = steeringAngle / (Math.abs(currentSegment.steeringMax ?? 60) || 1);
    gLat = clamp(gLatPeak * normAngle * (speed / 260), -2.5, 2.5);
  }

  return {
    speed: Math.round(speed * 10) / 10,
    throttle: Math.round(throttle * 100) / 100,
    brake: Math.round(brake * 100) / 100,
    steeringAngle: Math.round(steeringAngle * 10) / 10,
    gLat: Math.round(gLat * 100) / 100,
  };
}

export function generateLapTelemetry(isReferenceLap: boolean): TelemetryPoint[] {
  const totalLength = MONZA_CIRCUIT_CONFIG.totalLength; // 5793m
  const interval = 12.5; // ~464 points across 5,793m
  const points: TelemetryPoint[] = [];

  let currentDist = 0;
  let cumulativeTime = 0;
  let prevSpeedKmh = 280;

  // Global physics calibration scaler
  const baseScale = 0.999;

  while (currentDist <= totalLength) {
    const rawPhysics = evaluateCircuitPoint(currentDist, isReferenceLap);
    const speedKmh = rawPhysics.speed * baseScale;

    if (points.length > 0) {
      const prevPoint = points[points.length - 1]!;
      const deltaDistance = currentDist - prevPoint.distance;
      const avgSpeedKmh = Math.max(30, (prevSpeedKmh + speedKmh) / 2);
      const avgSpeedMs = (avgSpeedKmh * 1000) / 3600;
      const deltaTime = deltaDistance / avgSpeedMs;
      cumulativeTime += deltaTime;
    }

    let gLong = 0;
    if (points.length > 0) {
      const prevPoint = points[points.length - 1]!;
      const dt = cumulativeTime - prevPoint.time;
      if (dt > 0.0001) {
        const dv = ((speedKmh - prevSpeedKmh) * 1000) / 3600;
        const accelMs2 = dv / dt;
        gLong = clamp(accelMs2 / 9.80665, -2.0, 1.2);
      }
    }

    const { gear, rpm } = calculateGearAndRPM(speedKmh);

    points.push({
      distance: Math.round(currentDist * 10) / 10,
      time: Math.round(cumulativeTime * 1000) / 1000,
      speed: Math.round(speedKmh * 10) / 10,
      throttle: rawPhysics.throttle,
      brake: rawPhysics.brake,
      gear,
      rpm,
      steeringAngle: rawPhysics.steeringAngle,
      gLat: rawPhysics.gLat,
      gLong: Math.round(gLong * 100) / 100,
    });

    prevSpeedKmh = speedKmh;
    currentDist += interval;
  }

  // Exact finish line marker at 5793m
  const lastPoint = points[points.length - 1]!;
  if (lastPoint.distance < totalLength) {
    const deltaDist = totalLength - lastPoint.distance;
    const avgSpeedMs = (lastPoint.speed * 1000) / 3600;
    const dt = deltaDist / avgSpeedMs;
    const finishTime = lastPoint.time + dt;
    const { gear, rpm } = calculateGearAndRPM(lastPoint.speed);

    points.push({
      distance: totalLength,
      time: Math.round(finishTime * 1000) / 1000,
      speed: lastPoint.speed,
      throttle: 1.0,
      brake: 0.0,
      gear,
      rpm,
      steeringAngle: 0.0,
      gLat: 0.0,
      gLong: 0.15,
    });
  }

  return points;
}

export function calculateSectors(
  refLap: TelemetryPoint[],
  compLap: TelemetryPoint[]
): SectorSplit[] {
  const [s1Marker, s2Marker] = MONZA_CIRCUIT_CONFIG.sectorMarkers;
  const finishMarker = MONZA_CIRCUIT_CONFIG.totalLength;

  function getTimeAtDistance(lap: TelemetryPoint[], targetDist: number): number {
    for (let i = 0; i < lap.length - 1; i++) {
      const p1 = lap[i]!;
      const p2 = lap[i + 1]!;
      if (targetDist >= p1.distance && targetDist <= p2.distance) {
        const factor = (targetDist - p1.distance) / (p2.distance - p1.distance || 1);
        return p1.time + factor * (p2.time - p1.time);
      }
    }
    return lap[lap.length - 1]!.time;
  }

  const s1Ref = getTimeAtDistance(refLap, s1Marker);
  const s1Comp = getTimeAtDistance(compLap, s1Marker);

  const s2Ref = getTimeAtDistance(refLap, s2Marker);
  const s2Comp = getTimeAtDistance(compLap, s2Marker);

  const s3Ref = refLap[refLap.length - 1]!.time;
  const s3Comp = compLap[compLap.length - 1]!.time;

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
      distanceMarker: finishMarker,
      splitTimeLap1: Math.round(s3Ref * 1000) / 1000,
      splitTimeLap2: Math.round(s3Comp * 1000) / 1000,
      deltaSeconds: Math.round((s3Comp - s3Ref) * 1000) / 1000,
    },
  ];
}

export function generateTelemetrySession(): TelemetrySession {
  const referenceLap = generateLapTelemetry(true);
  const comparisonLap = generateLapTelemetry(false);
  const sectors = calculateSectors(referenceLap, comparisonLap);

  return {
    id: 'benchmark-demo',
    name: 'Monza Benchmark (Spec Racer Mock)',
    car: 'Ray FF1600 / Spec Racer',
    track: 'Autodromo Nazionale Monza - 5.793km',
    trackName: 'Autodromo Nazionale Monza - 5.793km',
    carName: 'Ray FF1600 / Spec Racer',
    isRealData: false,
    refDriver: 'Driver 1 (Reference)',
    compDriver: 'Driver 2 (Comparison)',
    refLapTime: '1:26.050',
    compLapTime: '1:26.775',
    driver1Meta: {
      driverNumber: 77,
      driverCode: 'REF',
      driverName: 'Reference Driver',
      teamName: 'Apex Racing Team',
      teamColor: '#00f0ff',
      carModel: 'Ray FF1600 / Spec Racer',
      lapTimeFormatted: '1:26.050',
      lapTimeSeconds: 86.05,
    },
    driver2Meta: {
      driverNumber: 99,
      driverCode: 'TGT',
      driverName: 'Target Driver',
      teamName: 'Apex Racing Team',
      teamColor: '#ff3864',
      carModel: 'Ray FF1600 / Spec Racer',
      lapTimeFormatted: '1:26.775',
      lapTimeSeconds: 86.775,
    },
    referenceLap,
    comparisonLap,
    sectors,
  };
}

export const PRECOMPUTED_SESSION: TelemetrySession = generateTelemetrySession();
