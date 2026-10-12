import { createContext } from 'react';
import type { TelemetryPoint, TelemetrySession } from '../types/telemetry';

export interface TelemetryContextValue {
  session: TelemetrySession;
  activeDistance: number;
  hoveredPointRef: TelemetryPoint | null;
  hoveredPointComp: TelemetryPoint | null;
  deltaAtHover: number | null;
  isHovering: boolean;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5, 1.0, 2.0, 4.0
  activeSessionId: string;
  setActiveDistance: (distance: number) => void;
  setIsHovering: (hovering: boolean) => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  stepDistance: (deltaMeters: number) => void;
  switchSession: (newSession: TelemetrySession) => void;
}

export const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);
