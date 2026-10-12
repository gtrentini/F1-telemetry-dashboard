import React, { useRef, useCallback } from 'react';
import styles from './PlaybackControls.module.scss';
import { useTelemetry } from '../../context/useTelemetry';

const SPEEDS = [0.5, 1.0, 2.0, 4.0];

export const PlaybackControls: React.FC = () => {
  const {
    session,
    activeDistance,
    setActiveDistance,
    isPlaying,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
    stepDistance,
  } = useTelemetry();

  const lastDist = session.referenceLap?.[session.referenceLap.length - 1]?.distance;
  const totalTrackDistance = lastDist && lastDist > 1000 ? Math.round(lastDist) : 5793;
  const s1Marker = session.sectors?.[0]?.distanceMarker ?? 1950;
  const s2Marker = session.sectors?.[1]?.distanceMarker ?? 4150;

  const timelineRef = useRef<HTMLDivElement>(null);

  const handleTimelineScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
      const el = timelineRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, clickX / rect.width));
      setActiveDistance(progress * totalTrackDistance);
    },
    [setActiveDistance, totalTrackDistance]
  );

  const progressPercent = Math.min(100, Math.max(0, (activeDistance / totalTrackDistance) * 100));

  return (
    <div className={styles.transportBar}>
      {/* Timeline Scrubbing Bar */}
      <div className={styles.timelineRow}>
        <div
          ref={timelineRef}
          className={styles.timelineTrack}
          onPointerDown={handleTimelineScrub}
          title="Click or drag to seek track position"
        >
          <div
            className={styles.timelineFill}
            style={{ width: `${progressPercent}%` }}
          />
          {/* Sector 1 & Sector 2 split line markers */}
          <div
            className={styles.sectorMarkerLines}
            style={{ left: `${(s1Marker / totalTrackDistance) * 100}%` }}
            title={`Sector 1 End (${s1Marker}m)`}
          />
          <div
            className={styles.sectorMarkerLines}
            style={{ left: `${(s2Marker / totalTrackDistance) * 100}%` }}
            title={`Sector 2 End (${s2Marker}m)`}
          />
        </div>

        <div className={styles.distanceReadout}>
          <span>{Math.round(activeDistance).toLocaleString()}m</span>
          <span className={styles.totalDist}> / {totalTrackDistance.toLocaleString()}m</span>
        </div>
      </div>

      {/* Control Action Buttons */}
      <div className={styles.controlsRow}>
        <div className={styles.playbackGroup}>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${styles.primaryPlay}`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause playback (Space)' : 'Start playback (Space)'}
          >
            <span className={styles.btnIcon}>{isPlaying ? '❚❚' : '▶'}</span>
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={() => stepDistance(-50)}
            title="Step backward 50m (Arrow Left)"
          >
            <span className={styles.btnIcon}>◀◀</span>
            <span>-50m</span>
          </button>

          <button
            type="button"
            className={styles.ctrlBtn}
            onClick={() => stepDistance(50)}
            title="Step forward 50m (Arrow Right)"
          >
            <span>+50m</span>
            <span className={styles.btnIcon}>▶▶</span>
          </button>
        </div>

        {/* Playback Speed Rate Selectors */}
        <div className={styles.speedGroup}>
          <span className={styles.speedLabel}>Speed:</span>
          {SPEEDS.map((spd) => (
            <button
              key={spd}
              type="button"
              className={`${styles.speedBtn} ${
                playbackSpeed === spd ? styles.activeSpeed : ''
              }`}
              onClick={() => setPlaybackSpeed(spd)}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Hotkey Shortcuts Hint */}
        <div className={styles.hotkeyHints}>
          <span>
            <kbd>Space</kbd> Play/Pause
          </span>
          <span>
            <kbd>◄</kbd> <kbd>►</kbd> ±50m Seek
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlaybackControls;
