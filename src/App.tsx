import React from 'react';
import styles from './App.module.scss';
import { PRECOMPUTED_SESSION } from './mock/telemetryGenerator';
import { TelemetryProvider } from './context/TelemetryContext';
import { useTelemetry } from './context/useTelemetry';
import { TelemetryCanvas } from './components/TelemetryCanvas/TelemetryCanvas';
import { PlaybackControls } from './components/PlaybackControls/PlaybackControls';
import { TrackMap } from './components/TrackMap/TrackMap';
import { GGCircle } from './components/GGCircle/GGCircle';
import { SectorSplits } from './components/SectorSplits/SectorSplits';
import { TelemetryStream } from './components/TelemetryStream/TelemetryStream';
import { SessionSelector } from './components/SessionSelector/SessionSelector';

/**
 * Format raw seconds into standard motorsport timing string mm:ss.fff
 */
function formatLapTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00.000';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((totalSeconds % 1) * 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis
    .toString()
    .padStart(3, '0')}`;
}

/**
 * Format delta times with explicit sign indicator (+0.123s or -0.050s)
 */
function formatDelta(deltaSeconds: number): string {
  const sign = deltaSeconds > 0 ? '+' : '';
  return `${sign}${deltaSeconds.toFixed(3)}s`;
}

export const AppContent: React.FC = () => {
  const { session } = useTelemetry();

  const refLapTotal = session.referenceLap[session.referenceLap.length - 1]?.time ?? 0;
  const compLapTotal = session.comparisonLap[session.comparisonLap.length - 1]?.time ?? 0;
  const totalDelta = compLapTotal - refLapTotal;

  return (
    <div className={styles.workstation}>
      {/* 1. Dense Engineering Telemetry Header */}
      <header className={styles.telemetryHeader}>
        <div className={styles.brandSection}>
          <div className={styles.brandBadge}>
            <span className={styles.brandLogoPulse} />
            <span className={styles.brandName}>ApexTrace</span>
          </div>
          <div className={styles.sessionMeta}>
            <div className={styles.titleWithBadge}>
              <span className={styles.trackTitle}>{session.trackName}</span>
            </div>
            <span className={styles.carTitle}>{session.carName}</span>
          </div>

          {/* Cockpit Status Pill Badge */}
          {session.isRealData ? (
            <div className={styles.cockpitStatusLive}>
              <span className={styles.pulseDotLive} />
              <span className={styles.statusPillLabel}>[LIVE F1 TELEMETRY]</span>
              {session.driver1Meta?.driverCode && session.driver2Meta?.driverCode && (
                <span className={styles.teamBadges}>
                  <span
                    className={styles.driverTag}
                    style={{ color: session.driver1Meta.teamColor || '#00f0ff' }}
                  >
                    {session.driver1Meta.driverCode}
                  </span>
                  <span className={styles.vsSeparator}>vs</span>
                  <span
                    className={styles.driverTag}
                    style={{ color: session.driver2Meta.teamColor || '#ff3864' }}
                  >
                    {session.driver2Meta.driverCode}
                  </span>
                </span>
              )}
            </div>
          ) : (
            <div className={styles.cockpitStatusDemo}>
              <span className={styles.pulseDotDemo} />
              <span className={styles.statusPillLabel}>[OFFLINE DEMO BENCHMARK]</span>
            </div>
          )}
        </div>

        {/* Multi-Session Selector & Telemetry Ingestion Dropdown */}
        <SessionSelector />

        <div className={styles.metricsSection}>
          <div
            className={`${styles.readoutBox} ${styles.refLap}`}
            style={session.driver1Meta?.teamColor ? { borderColor: `${session.driver1Meta.teamColor}66` } : undefined}
          >
            <span
              className={styles.readoutLabel}
              style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}
            >
              {session.driver1Meta
                ? `#${session.driver1Meta.driverNumber} ${session.driver1Meta.driverCode}`
                : session.refDriver
                ? 'REF (L1)'
                : 'LAP 1 (REF)'}
            </span>
            <span className={styles.readoutValue}>{formatLapTime(refLapTotal)}</span>
          </div>

          <div
            className={`${styles.readoutBox} ${styles.compLap}`}
            style={session.driver2Meta?.teamColor ? { borderColor: `${session.driver2Meta.teamColor}66` } : undefined}
          >
            <span
              className={styles.readoutLabel}
              style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}
            >
              {session.driver2Meta
                ? `#${session.driver2Meta.driverNumber} ${session.driver2Meta.driverCode}`
                : session.compDriver
                ? 'TGT (L2)'
                : 'LAP 2 (TGT)'}
            </span>
            <span className={styles.readoutValue}>{formatLapTime(compLapTotal)}</span>
          </div>

          <div className={`${styles.readoutBox} ${styles.deltaBox}`}>
            <span className={styles.readoutLabel}>DELTA GAP</span>
            <span
              className={`${styles.readoutValue} ${
                totalDelta > 0 ? styles.slower : styles.faster
              }`}
            >
              {formatDelta(totalDelta)}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Primary Workstation Workspace */}
      <main className={styles.workbench}>
        {/* Quick Micro-Sector Cards */}
        <section className={styles.overviewGrid}>
          {session.sectors.map((sec) => (
            <div key={sec.sectorIndex} className={styles.sectorCard}>
              <div className={styles.sectorHeader}>
                <span className={styles.sectorTitle}>Sector {sec.sectorIndex} Split</span>
                <span className={styles.sectorMarker}>@{sec.distanceMarker}m</span>
              </div>
              <div className={styles.sectorSplits}>
                <div className={styles.splitItem}>
                  <span className={styles.splitLabel}>{session.driver1Meta?.driverCode || 'Lap 1'}</span>
                  <span
                    className={`${styles.splitValue} ${styles.lap1}`}
                    style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}
                  >
                    {sec.splitTimeLap1.toFixed(3)}s
                  </span>
                </div>
                <div className={styles.splitItem}>
                  <span className={styles.splitLabel}>{session.driver2Meta?.driverCode || 'Lap 2'}</span>
                  <span
                    className={`${styles.splitValue} ${styles.lap2}`}
                    style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}
                  >
                    {sec.splitTimeLap2.toFixed(3)}s
                  </span>
                </div>
                <div className={styles.splitItem}>
                  <span className={styles.splitLabel}>Delta</span>
                  <span
                    className={`${styles.splitValue} ${
                      sec.deltaSeconds > 0 ? styles.slower : styles.faster
                    }`}
                  >
                    {formatDelta(sec.deltaSeconds)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Dual-Column Split Telemetry Layout */}
        <section className={styles.splitLayout}>
          {/* Left Column: Canvas Engine + Playback Transport Bar */}
          <div className={styles.leftColumn}>
            <TelemetryCanvas />
            <PlaybackControls />
          </div>

          {/* Right Column: Track Map & G-G Friction Circle + Sector Splits Analysis */}
          <div className={styles.rightColumn}>
            <div className={styles.mapAndGgRow}>
              <TrackMap />
              <GGCircle />
            </div>
            <SectorSplits />
          </div>
        </section>

        {/* Live Telemetry Stream Ticker & Collapsible Channel Log Drawer */}
        <section>
          <TelemetryStream />
        </section>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TelemetryProvider session={PRECOMPUTED_SESSION}>
      <AppContent />
    </TelemetryProvider>
  );
};

export default App;
