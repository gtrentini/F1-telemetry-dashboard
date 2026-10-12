import { useContext } from 'react';
import { TelemetryContext } from './TelemetryContextDefinition';
import type { TelemetryContextValue } from './TelemetryContextDefinition';

export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
