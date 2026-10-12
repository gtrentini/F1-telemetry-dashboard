import React, { useMemo } from 'react';
import styles from './SectorSplits.module.scss';
import { useTelemetry } from '../../context/useTelemetry';

interface SectorRowData {
  sectorKey: 's1' | 's2' | 's3' | 'total';
  name: string;
  markerText: string;
  splitRef: number;
  splitComp: number;
  delta: number;
  topSpeedRef: number;
  topSpeedComp: number;
  isActive: boolean;
}

function formatSplit(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  if (mins > 0) {
    const paddedSecs = (seconds % 60).toFixed(3).padStart(6, '0');
    return `${mins}:${paddedSecs}`;
  }
  return `${secs}s`;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}s`;
}

export const SectorSplits: React.FC = () => {
  const { session, activeDistance } = useTelemetry();

  // Active sector index based on current scrubbed distance
  const currentSectorIndex = useMemo(() => {
    if (activeDistance < 1950) return 1;
    if (activeDistance < 4150) return 2;
    return 3;
  }, [activeDistance]);

  const sectorRows = useMemo<SectorRowData[]>(() => {
    const refLap = session.referenceLap;
    const compLap = session.comparisonLap;

    // Filter points by sector to compute top speeds
    const s1RefPts = refLap.filter((p) => p.distance <= 1950);
    const s1CompPts = compLap.filter((p) => p.distance <= 1950);

    const s2RefPts = refLap.filter((p) => p.distance > 1950 && p.distance <= 4150);
    const s2CompPts = compLap.filter((p) => p.distance > 1950 && p.distance <= 4150);

    const s3RefPts = refLap.filter((p) => p.distance > 4150);
    const s3CompPts = compLap.filter((p) => p.distance > 4150);

    const getMaxSpeed = (pts: typeof refLap) =>
      pts.reduce((max, p) => (p.speed > max ? p.speed : max), 0);

    const s1SplitRef = session.sectors[0]?.splitTimeLap1 ?? 0;
    const s1SplitComp = session.sectors[0]?.splitTimeLap2 ?? 0;
    const s1Delta = session.sectors[0]?.deltaSeconds ?? 0;

    const s2CumRef = session.sectors[1]?.splitTimeLap1 ?? 0;
    const s2CumComp = session.sectors[1]?.splitTimeLap2 ?? 0;
    // Individual sector duration
    const s2SplitRef = s2CumRef - s1SplitRef;
    const s2SplitComp = s2CumComp - s1SplitComp;
    const s2Delta = s2SplitComp - s2SplitRef;

    const s3CumRef = session.sectors[2]?.splitTimeLap1 ?? 0;
    const s3CumComp = session.sectors[2]?.splitTimeLap2 ?? 0;
    const s3SplitRef = s3CumRef - s2CumRef;
    const s3SplitComp = s3CumComp - s2CumComp;
    const s3Delta = s3SplitComp - s3SplitRef;

    const totalRef = s3CumRef;
    const totalComp = s3CumComp;
    const totalDelta = totalComp - totalRef;

    return [
      {
        sectorKey: 's1',
        name: 'Sector 1 (Prima Variante & Biassono)',
        markerText: '0m - 1,950m',
        splitRef: s1SplitRef,
        splitComp: s1SplitComp,
        delta: s1Delta,
        topSpeedRef: getMaxSpeed(s1RefPts),
        topSpeedComp: getMaxSpeed(s1CompPts),
        isActive: currentSectorIndex === 1,
      },
      {
        sectorKey: 's2',
        name: 'Sector 2 (Roggia, Lesmo & Serraglio)',
        markerText: '1,950m - 4,150m',
        splitRef: s2SplitRef,
        splitComp: s2SplitComp,
        delta: s2Delta,
        topSpeedRef: getMaxSpeed(s2RefPts),
        topSpeedComp: getMaxSpeed(s2CompPts),
        isActive: currentSectorIndex === 2,
      },
      {
        sectorKey: 's3',
        name: 'Sector 3 (Ascari & Parabolica / Alboreto)',
        markerText: '4,150m - 5,793m',
        splitRef: s3SplitRef,
        splitComp: s3SplitComp,
        delta: s3Delta,
        topSpeedRef: getMaxSpeed(s3RefPts),
        topSpeedComp: getMaxSpeed(s3CompPts),
        isActive: currentSectorIndex === 3,
      },
      {
        sectorKey: 'total',
        name: 'Lap Total',
        markerText: 'Full 5,793m circuit',
        splitRef: totalRef,
        splitComp: totalComp,
        delta: totalDelta,
        topSpeedRef: getMaxSpeed(refLap),
        topSpeedComp: getMaxSpeed(compLap),
        isActive: false,
      },
    ];
  }, [session, currentSectorIndex]);

  return (
    <div className={styles.sectorPanel}>
      <div className={styles.sectorHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.title}>Micro-Sector Delta Analysis</span>
          <span className={styles.badge}>SECTOR SPLITS</span>
        </div>
        <span className={styles.meta}>Active Sector: S{currentSectorIndex}</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.sectorTable}>
          <thead>
            <tr>
              <th>Sector</th>
              <th>Range</th>
              <th style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}>
                {session.driver1Meta
                  ? `${session.driver1Meta.driverCode} (${session.driver1Meta.carModel || 'Ref'})`
                  : 'Lap 1 Split'}
              </th>
              <th style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}>
                {session.driver2Meta
                  ? `${session.driver2Meta.driverCode} (${session.driver2Meta.carModel || 'Tgt'})`
                  : 'Lap 2 Split'}
              </th>
              <th>Delta (±)</th>
              <th>
                Top Speed ({session.driver1Meta?.driverCode || 'Ref'} / {session.driver2Meta?.driverCode || 'Tgt'})
              </th>
            </tr>
          </thead>
          <tbody>
            {sectorRows.map((row) => (
              <tr
                key={row.sectorKey}
                className={`${row.isActive ? styles.activeSector : ''} ${
                  row.sectorKey === 'total' ? styles.totalRow : ''
                }`}
              >
                <td>
                  <div className={styles.sectorNameCell}>
                    <span className={`${styles.sectorPill} ${styles[row.sectorKey]}`}>
                      {row.sectorKey === 'total' ? 'TOT' : row.sectorKey.toUpperCase()}
                    </span>
                    <span className={styles.nameText}>{row.name}</span>
                  </div>
                </td>
                <td>{row.markerText}</td>
                <td
                  className={styles.refTime}
                  style={session.driver1Meta?.teamColor ? { color: session.driver1Meta.teamColor } : undefined}
                >
                  {formatSplit(row.splitRef)}
                </td>
                <td
                  className={styles.tgtTime}
                  style={session.driver2Meta?.teamColor ? { color: session.driver2Meta.teamColor } : undefined}
                >
                  {formatSplit(row.splitComp)}
                </td>
                <td
                  className={`${styles.deltaCell} ${
                    row.delta > 0 ? styles.slower : row.delta < 0 ? styles.faster : ''
                  }`}
                >
                  {formatDelta(row.delta)}
                </td>
                <td className={styles.speedCell}>
                  {row.topSpeedRef.toFixed(1)} / {row.topSpeedComp.toFixed(1)} km/h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SectorSplits;
