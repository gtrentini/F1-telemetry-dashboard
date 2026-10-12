import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { TelemetryPoint, TelemetrySession } from '../types/telemetry';
import { TelemetryContext } from './TelemetryContextDefinition';
import type { TelemetryContextValue } from './TelemetryContextDefinition';

interface TelemetryProviderProps {
  session: TelemetrySession;
  children: React.ReactNode;
}

/**
 * Linearly interpolate between two points based on distance
 */
function interpolatePoint(p1: TelemetryPoint, p2: TelemetryPoint, d: number): TelemetryPoint {
  const span = p2.distance - p1.distance;
  if (span <= 0) return { ...p1 };
  const factor = Math.max(0, Math.min(1, (d - p1.distance) / span));

  return {
    distance: d,
    time: p1.time + (p2.time - p1.time) * factor,
    speed: p1.speed + (p2.speed - p1.speed) * factor,
    throttle: p1.throttle + (p2.throttle - p1.throttle) * factor,
    brake: p1.brake + (p2.brake - p1.brake) * factor,
    gear: factor < 0.5 ? p1.gear : p2.gear,
    rpm: Math.round(p1.rpm + (p2.rpm - p1.rpm) * factor),
    steeringAngle: p1.steeringAngle + (p2.steeringAngle - p1.steeringAngle) * factor,
    gLat: p1.gLat + (p2.gLat - p1.gLat) * factor,
    gLong: p1.gLong + (p2.gLong - p1.gLong) * factor,
  };
}

/**
 * Find or interpolate TelemetryPoint at a specific track distance `d`
 */
function getPointAtDistance(lap: TelemetryPoint[], d: number): TelemetryPoint | null {
  if (lap.length === 0) return null;
  if (d <= lap[0]!.distance) return lap[0]!;
  if (d >= lap[lap.length - 1]!.distance) return lap[lap.length - 1]!;

  let low = 0;
  let high = lap.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const pt = lap[mid]!;
    if (pt.distance === d) return pt;
    if (pt.distance < d) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const i1 = Math.max(0, high);
  const i2 = Math.min(lap.length - 1, low);
  const p1 = lap[i1]!;
  const p2 = lap[i2]!;

  return interpolatePoint(p1, p2, d);
}

const TOTAL_TRACK_DISTANCE = 5793;

export const TelemetryProvider: React.FC<TelemetryProviderProps> = ({ session: initialSession, children }) => {
  const [activeSession, setActiveSession] = useState<TelemetrySession>(initialSession);
  const [activeDistance, setActiveDistanceState] = useState<number>(0);
  const [isHovering, setIsHoveringState] = useState<boolean>(false);
  const [isPlaying, setIsPlayingState] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(1.0);

  // Refs for requestAnimationFrame playback loop
  const activeDistanceRef = useRef(activeDistance);
  const isPlayingRef = useRef(isPlaying);
  const playbackSpeedRef = useRef(playbackSpeed);
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    activeDistanceRef.current = activeDistance;
  }, [activeDistance]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const setActiveDistance = useCallback((dist: number) => {
    const maxDist = activeSession.referenceLap[activeSession.referenceLap.length - 1]?.distance ?? TOTAL_TRACK_DISTANCE;
    const clamped = Math.max(0, Math.min(maxDist, dist));
    activeDistanceRef.current = clamped;
    setActiveDistanceState(clamped);
  }, [activeSession.referenceLap]);

  const switchSession = useCallback((newSession: TelemetrySession) => {
    setActiveSession(newSession);
    // Keep activeDistance clamped to new session's track length while preserving current progress
    const newMax = newSession.referenceLap[newSession.referenceLap.length - 1]?.distance ?? TOTAL_TRACK_DISTANCE;
    if (activeDistanceRef.current > newMax) {
      activeDistanceRef.current = newMax;
      setActiveDistanceState(newMax);
    }
  }, []);

  const setIsHovering = useCallback((hovering: boolean) => {
    setIsHoveringState(hovering);
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setIsPlayingState(playing);
    if (playing) {
      lastFrameTimeRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlayingState((prev) => {
      const next = !prev;
      if (next) {
        lastFrameTimeRef.current = null;
      }
      return next;
    });
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeedState(speed);
  }, []);

  const stepDistance = useCallback((deltaMeters: number) => {
    const maxDist = activeSession.referenceLap[activeSession.referenceLap.length - 1]?.distance ?? TOTAL_TRACK_DISTANCE;
    setActiveDistanceState((curr) => {
      let next = curr + deltaMeters;
      if (next < 0) next = 0;
      if (next > maxDist) next = maxDist;
      activeDistanceRef.current = next;
      return next;
    });
  }, [activeSession.referenceLap]);

  // 60fps requestAnimationFrame physics animation loop
  useEffect(() => {
    let animId: number;

    const animate = (timestamp: number) => {
      if (isPlayingRef.current) {
        if (lastFrameTimeRef.current !== null) {
          const deltaSec = (timestamp - lastFrameTimeRef.current) / 1000;
          const currentPt = getPointAtDistance(activeSession.referenceLap, activeDistanceRef.current);
          const currentSpeedKmh = currentPt?.speed ?? 200;
          const currentSpeedMs = (currentSpeedKmh * 1000) / 3600;

          const distanceDelta = currentSpeedMs * deltaSec * playbackSpeedRef.current;
          let nextDist = activeDistanceRef.current + distanceDelta;

          const maxDist = activeSession.referenceLap[activeSession.referenceLap.length - 1]?.distance ?? TOTAL_TRACK_DISTANCE;
          if (nextDist >= maxDist) {
            nextDist = nextDist % maxDist;
          }

          activeDistanceRef.current = nextDist;
          setActiveDistanceState(nextDist);
        }
        lastFrameTimeRef.current = timestamp;
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeSession.referenceLap]);

  // Global keyboard shortcuts (Space to toggle play, Arrow Left/Right to seek 50m)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepDistance(-50);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepDistance(50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, stepDistance]);

  const hoveredPointRef = useMemo(() => {
    return getPointAtDistance(activeSession.referenceLap, activeDistance);
  }, [activeSession.referenceLap, activeDistance]);

  const hoveredPointComp = useMemo(() => {
    return getPointAtDistance(activeSession.comparisonLap, activeDistance);
  }, [activeSession.comparisonLap, activeDistance]);

  const deltaAtHover = useMemo(() => {
    if (!hoveredPointRef || !hoveredPointComp) return null;
    return hoveredPointComp.time - hoveredPointRef.time;
  }, [hoveredPointRef, hoveredPointComp]);

  const value = useMemo<TelemetryContextValue>(() => ({
    session: activeSession,
    activeDistance,
    hoveredPointRef,
    hoveredPointComp,
    deltaAtHover,
    isHovering,
    isPlaying,
    playbackSpeed,
    activeSessionId: activeSession.id || 'benchmark-demo',
    setActiveDistance,
    setIsHovering,
    togglePlay,
    setIsPlaying,
    setPlaybackSpeed,
    stepDistance,
    switchSession,
  }), [
    activeSession,
    activeDistance,
    hoveredPointRef,
    hoveredPointComp,
    deltaAtHover,
    isHovering,
    isPlaying,
    playbackSpeed,
    setActiveDistance,
    setIsHovering,
    togglePlay,
    setIsPlaying,
    setPlaybackSpeed,
    stepDistance,
    switchSession,
  ]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};
