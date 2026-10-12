import React, { useState, useRef, useEffect, useMemo } from 'react';
import styles from './TelemetryStream.module.scss';
import { useTelemetry } from '../../context/useTelemetry';

export const TelemetryStream: React.FC = () => {
  const { session, activeDistance, hoveredPointRef, hoveredPointComp, deltaAtHover, isPlaying, setActiveDistance } =
    useTelemetry();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const activeRowRef = useRef<HTMLTableRowElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const ref = hoveredPointRef;
  const comp = hoveredPointComp;

  const rpmPercent = ref ? Math.max(0, Math.min(100, ((ref.rpm - 3500) / (8200 - 3500)) * 100)) : 0;
  const throttlePercent = ref ? Math.round(ref.throttle * 100) : 0;
  const brakePercent = ref ? Math.round(ref.brake * 100) : 0;

  const speedDelta = ref && comp ? comp.speed - ref.speed : 0;
  const deltaSec = deltaAtHover ?? 0;

  // Find closest point index in session.referenceLap for active highlighting
  const activePointIndex = useMemo(() => {
    let closestIdx = 0;
    let minDiff = Infinity;
    const lap = session.referenceLap;
    for (let i = 0; i < lap.length; i++) {
      const diff = Math.abs(lap[i]!.distance - activeDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [session.referenceLap, activeDistance]);

  // Auto-scroll active row into view when drawer is open
  useEffect(() => {
    if (isDrawerOpen && activeRowRef.current && tableContainerRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activePointIndex, isDrawerOpen]);

  return (
    <div className={styles.streamContainer}>
      {/* Header bar with drawer toggle */}
      <div className={styles.streamHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Live Telemetry Stream & Diagnostics</span>
          <span className={styles.badge}>
            {isPlaying ? 'ENGINE ACTIVE • STREAMING' : 'SCRUBBER PAUSED'}
          </span>
        </div>

        <div className={styles.actionGroup}>
          <span className={styles.meta}>
            Location: {Math.round(activeDistance)}m / 5,793m • {session.referenceLap.length} Samples
          </span>

          <button
            type="button"
            className={`${styles.toggleDrawerBtn} ${isDrawerOpen ? styles.drawerOpen : ''}`}
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            title="Toggle full raw channel log drawer"
          >
            <span>{isDrawerOpen ? 'Hide Channel Log' : 'Show Channel Log'}</span>
            <span className={`${styles.btnArrow} ${isDrawerOpen ? styles.arrowRotated : ''}`}>
              ▼
            </span>
          </button>
        </div>
      </div>

      {/* Primary Ticker HUD Grid */}
      <div className={styles.tickerGrid}>
        {/* Powertrain: Gear & RPM Bar */}
        <div className={styles.tickerCard}>
          <span className={styles.tickerLabel}>GEAR & RPM TACHOMETER</span>
          <span className={styles.tickerValue}>
            G{ref?.gear ?? 1} • {ref?.rpm.toLocaleString() ?? '—'}{' '}
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>RPM</span>
          </span>
          <div className={styles.tickerBarRow}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${styles.rpmFill}`}
                style={{ width: `${rpmPercent}%` }}
              />
            </div>
            <span className={styles.barValueText}>{Math.round(rpmPercent)}% redline</span>
          </div>
        </div>

        {/* Speed Comparison & Delta */}
        <div className={styles.tickerCard}>
          <span className={styles.tickerLabel}>
            SPEED ({session.driver1Meta?.driverCode || 'REF'} vs {session.driver2Meta?.driverCode || 'TGT'})
          </span>
          <span className={styles.tickerValue}>
            <span
              className={styles.refColor}
              style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}
            >
              {ref?.speed.toFixed(1) ?? '—'}
            </span>
            {' / '}
            <span
              className={styles.compColor}
              style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}
            >
              {comp?.speed.toFixed(1) ?? '—'}
            </span>{' '}
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>km/h</span>
          </span>
          <span className={styles.tickerSub}>
            Speed Delta: {speedDelta > 0 ? `+${speedDelta.toFixed(1)}` : speedDelta.toFixed(1)} km/h
          </span>
        </div>

        {/* Dynamic Throttle Bar */}
        <div className={styles.tickerCard}>
          <span className={styles.tickerLabel}>THROTTLE POSITION</span>
          <span className={styles.tickerValue} style={{ color: '#00e676' }}>
            {throttlePercent}%
          </span>
          <div className={styles.tickerBarRow}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${styles.throttleFill}`}
                style={{ width: `${throttlePercent}%` }}
              />
            </div>
            <span className={styles.barValueText}>{ref?.throttle.toFixed(2) ?? '0.00'}</span>
          </div>
        </div>

        {/* Dynamic Brake Bar */}
        <div className={styles.tickerCard}>
          <span className={styles.tickerLabel}>BRAKE PRESSURE</span>
          <span className={styles.tickerValue} style={{ color: '#ff1744' }}>
            {brakePercent}%
          </span>
          <div className={styles.tickerBarRow}>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${styles.brakeFill}`}
                style={{ width: `${brakePercent}%` }}
              />
            </div>
            <span className={styles.barValueText}>{ref?.brake.toFixed(2) ?? '0.00'}</span>
          </div>
        </div>

        {/* Micro-Sector Delta Gap */}
        <div className={styles.tickerCard}>
          <span className={styles.tickerLabel}>LIVE DELTA (LAP 2 GAP)</span>
          <span
            className={`${styles.tickerValue} ${
              deltaSec > 0 ? styles.slower : styles.faster
            }`}
          >
            {deltaSec !== 0 ? `${deltaSec > 0 ? '+' : ''}${deltaSec.toFixed(3)}s` : '0.000s'}
          </span>
          <span className={styles.tickerSub}>
            {deltaSec > 0 ? 'Trailing reference lap' : deltaSec < 0 ? 'Ahead of reference lap' : 'Level'}
          </span>
        </div>

        {/* Lateral & Longitudinal G-Forces */}
        <div className={styles.tickerCard}>
          <span className={styles.tickerLabel}>G-FORCE DYNAMICS</span>
          <span className={styles.tickerValue}>
            {ref ? `${ref.gLat > 0 ? '+' : ''}${ref.gLat.toFixed(2)} G (Lat)` : '0.00 G'}
          </span>
          <span className={styles.tickerSub}>
            Longitudinal: {ref ? `${ref.gLong > 0 ? '+' : ''}${ref.gLong.toFixed(2)} G` : '0.00 G'}
          </span>
        </div>
      </div>

      {/* Collapsible Channel Log Drawer */}
      {isDrawerOpen && (
        <div className={styles.drawerWrapper}>
          <div className={styles.tableContainer} ref={tableContainerRef}>
            <table className={styles.rawTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Distance (m)</th>
                  <th style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}>
                    Speed ({session.driver1Meta?.driverCode || 'Ref'})
                  </th>
                  <th style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}>
                    Speed ({session.driver2Meta?.driverCode || 'Tgt'})
                  </th>
                  <th>Δ Speed</th>
                  <th>Throttle</th>
                  <th>Brake</th>
                  <th>Gear</th>
                  <th>RPM</th>
                  <th>G-Lat</th>
                  <th>G-Long</th>
                </tr>
              </thead>
              <tbody>
                {session.referenceLap.map((refPt, idx) => {
                  const compPt = session.comparisonLap[idx] ?? refPt;
                  const deltaSpd = compPt.speed - refPt.speed;
                  const isActive = idx === activePointIndex;

                  return (
                    <tr
                      key={refPt.distance}
                      ref={isActive ? activeRowRef : undefined}
                      className={isActive ? styles.activeRow : undefined}
                      onClick={() => setActiveDistance(refPt.distance)}
                      title={`Seek to ${refPt.distance}m`}
                    >
                      <td>{idx + 1}</td>
                      <td>{refPt.distance.toFixed(1)}m</td>
                      <td
                        className={styles.refSpeed}
                        style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}
                      >
                        {refPt.speed.toFixed(1)}
                      </td>
                      <td
                        className={styles.compSpeed}
                        style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}
                      >
                        {compPt.speed.toFixed(1)}
                      </td>
                      <td
                        className={`${styles.deltaCell} ${
                          deltaSpd > 0 ? styles.faster : deltaSpd < 0 ? styles.slower : ''
                        }`}
                      >
                        {deltaSpd > 0 ? `+${deltaSpd.toFixed(1)}` : deltaSpd.toFixed(1)}
                      </td>
                      <td className={styles.throttleVal}>{(refPt.throttle * 100).toFixed(0)}%</td>
                      <td className={styles.brakeVal}>{(refPt.brake * 100).toFixed(0)}%</td>
                      <td>G{refPt.gear}</td>
                      <td>{refPt.rpm}</td>
                      <td>{refPt.gLat > 0 ? `+${refPt.gLat.toFixed(2)}` : refPt.gLat.toFixed(2)}</td>
                      <td>{refPt.gLong > 0 ? `+${refPt.gLong.toFixed(2)}` : refPt.gLong.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelemetryStream;
