import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './SessionExplorer.module.scss';
import { useTelemetry } from '../../context/useTelemetry';
import {
  getMeetings,
  getSessions,
  getDrivers,
  createOpenF1TelemetrySession,
  loadMonzaRealSession,
} from '../../services/openF1Service';
import type {
  OpenF1Meeting,
  OpenF1Session,
  OpenF1Driver,
} from '../../types/telemetry';

interface SessionExplorerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

export const SessionExplorer: React.FC<SessionExplorerProps> = ({ isOpen, onClose }) => {
  const { switchSession } = useTelemetry();

  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [meetings, setMeetings] = useState<OpenF1Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<OpenF1Meeting | null>(null);

  const [sessions, setSessions] = useState<OpenF1Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<OpenF1Session | null>(null);

  const [drivers, setDrivers] = useState<OpenF1Driver[]>([]);
  const [driver1, setDriver1] = useState<OpenF1Driver | null>(null);
  const [driver2, setDriver2] = useState<OpenF1Driver | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch meetings when Year changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function loadMeetings() {
      setIsLoading(true);
      setStatusMessage(`Fetching ${selectedYear} Grand Prix calendar...`);
      try {
        const list = await getMeetings(selectedYear);
        if (isMounted) {
          setMeetings(list);
          const monza = list.find((m) => m.circuit_short_name.toLowerCase().includes('monza'));
          setSelectedMeeting(monza || list[0] || null);
        }
      } catch (err) {
        if (isMounted) setErrorMessage((err as Error).message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setStatusMessage(null);
        }
      }
    }

    loadMeetings();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedYear]);

  // 2. Fetch sessions when selectedMeeting changes
  useEffect(() => {
    if (!selectedMeeting) {
      return;
    }
    let isMounted = true;

    async function loadSessions() {
      setIsLoading(true);
      setStatusMessage(`Fetching sessions for ${selectedMeeting?.meeting_name}...`);
      try {
        const list = await getSessions(selectedMeeting!.meeting_key);
        if (isMounted) {
          setSessions(list);
          const qualifying = list.find(
            (s) => s.session_name.toLowerCase().includes('qualifying') || s.session_type === 'Qualifying'
          );
          setSelectedSession(qualifying || list[0] || null);
        }
      } catch (err) {
        if (isMounted) setErrorMessage((err as Error).message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setStatusMessage(null);
        }
      }
    }

    loadSessions();
    return () => {
      isMounted = false;
    };
  }, [selectedMeeting]);

  // 3. Fetch drivers when selectedSession changes
  useEffect(() => {
    if (!selectedSession) {
      return;
    }
    let isMounted = true;

    async function loadDriversList() {
      setIsLoading(true);
      setStatusMessage(`Fetching driver entry list for ${selectedSession?.session_name}...`);
      try {
        const list = await getDrivers(selectedSession!.session_key);
        if (isMounted) {
          setDrivers(list);
          const lec = list.find((d) => d.name_acronym === 'LEC');
          const ver = list.find((d) => d.name_acronym === 'VER');
          setDriver1(lec || list[0] || null);
          setDriver2(ver || list[1] || null);
        }
      } catch (err) {
        if (isMounted) setErrorMessage((err as Error).message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setStatusMessage(null);
        }
      }
    }

    loadDriversList();
    return () => {
      isMounted = false;
    };
  }, [selectedSession]);

  // Handle instant Monza Demo fast load
  const handleInstantMonzaDemo = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Loading verified Monza GP 2024 Qualifying telemetry...');
    try {
      const session = await loadMonzaRealSession();
      switchSession(session);
      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  }, [switchSession, onClose]);

  // Handle Live Telemetry Ingestion from selected drivers
  const handleIngestLiveTelemetry = async () => {
    if (!selectedMeeting || !selectedSession || !driver1 || !driver2) {
      setErrorMessage('Please select meeting, session, and both drivers');
      return;
    }

    if (driver1.driver_number === driver2.driver_number) {
      setErrorMessage('Please choose two different drivers for telemetry comparison');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await createOpenF1TelemetrySession(
        selectedMeeting,
        selectedSession,
        driver1,
        driver2,
        (msg) => {
          setStatusMessage(msg);
        }
      );

      switchSession(session);
      onClose();
    } catch (err) {
      const errMsg = (err as Error).message || 'Driver did not record a completed timed lap in this session.';
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.explorerBackdrop} style={{ zIndex: 99999 }} onClick={onClose}>
      <div className={styles.explorerModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.modalTitle}>OpenF1 Session Explorer</span>
            <span className={styles.apiBadge}>LIVE TELEMETRY INGESTION</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Quick Launch Pre-loaded Monza Dataset */}
          <div className={styles.quickLaunchBar}>
            <div className={styles.quickLaunchText}>
              <span className={styles.quickTitle}>Monza GP 2024 Q3 (Leclerc vs. Verstappen)</span>
              <span className={styles.quickSub}>
                Instant zero-latency load • Verified 100% normalized telemetry & real GPS traces
              </span>
            </div>
            <button
              type="button"
              className={styles.instantBtn}
              onClick={handleInstantMonzaDemo}
              disabled={isLoading}
            >
              Load Demo (Instant)
            </button>
          </div>

          {/* Stepper / Filter Grid: Year, Meeting, Session */}
          <div className={styles.filterGrid}>
            <div className={styles.formField}>
              <label>Championship Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={isLoading}
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label>Grand Prix Meeting</label>
              <select
                value={selectedMeeting?.meeting_key ?? ''}
                onChange={(e) => {
                  const m = meetings.find((item) => item.meeting_key === Number(e.target.value));
                  setSelectedMeeting(m || null);
                }}
                disabled={isLoading || meetings.length === 0}
              >
                {meetings.map((m) => (
                  <option key={m.meeting_key} value={m.meeting_key}>
                    {m.meeting_name} ({m.circuit_short_name})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label>Session</label>
              <select
                value={selectedSession?.session_key ?? ''}
                onChange={(e) => {
                  const s = sessions.find((item) => item.session_key === Number(e.target.value));
                  setSelectedSession(s || null);
                }}
                disabled={isLoading || sessions.length === 0}
              >
                {sessions.map((s) => (
                  <option key={s.session_key} value={s.session_key}>
                    {s.session_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Driver Selection & Team Color Preview Section */}
          <div className={styles.driverSelectionSection}>
            <span className={styles.sectionTitle}>Paired Comparison Drivers</span>

            <div className={styles.driversRow}>
              {/* Driver 1 (Reference) */}
              <div className={styles.formField}>
                <label>Reference Driver (Driver 1)</label>
                <select
                  value={driver1?.driver_number ?? ''}
                  onChange={(e) => {
                    const d = drivers.find((item) => item.driver_number === Number(e.target.value));
                    setDriver1(d || null);
                  }}
                  disabled={isLoading || drivers.length === 0}
                >
                  {drivers.map((d) => (
                    <option key={`d1-${d.driver_number}`} value={d.driver_number}>
                      #{d.driver_number} {d.name_acronym} — {d.full_name} ({d.team_name})
                    </option>
                  ))}
                </select>

                {driver1 && (
                  <div className={styles.driverCardPreview}>
                    <div
                      className={styles.teamColorSwatch}
                      style={{ backgroundColor: driver1.team_colour ? `#${driver1.team_colour}` : '#00f0ff' }}
                    />
                    <div className={styles.driverInfo}>
                      <div className={styles.nameCode}>
                        <span className={styles.codeBadge}>{driver1.name_acronym}</span>
                        <span className={styles.numBadge}>#{driver1.driver_number}</span>
                      </div>
                      <span className={styles.teamText}>{driver1.team_name}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Driver 2 (Comparison) */}
              <div className={styles.formField}>
                <label>Target Driver (Driver 2)</label>
                <select
                  value={driver2?.driver_number ?? ''}
                  onChange={(e) => {
                    const d = drivers.find((item) => item.driver_number === Number(e.target.value));
                    setDriver2(d || null);
                  }}
                  disabled={isLoading || drivers.length === 0}
                >
                  {drivers.map((d) => (
                    <option key={`d2-${d.driver_number}`} value={d.driver_number}>
                      #{d.driver_number} {d.name_acronym} — {d.full_name} ({d.team_name})
                    </option>
                  ))}
                </select>

                {driver2 && (
                  <div className={styles.driverCardPreview}>
                    <div
                      className={styles.teamColorSwatch}
                      style={{ backgroundColor: driver2.team_colour ? `#${driver2.team_colour}` : '#ff3864' }}
                    />
                    <div className={styles.driverInfo}>
                      <div className={styles.nameCode}>
                        <span className={styles.codeBadge}>{driver2.name_acronym}</span>
                        <span className={styles.numBadge}>#{driver2.driver_number}</span>
                      </div>
                      <span className={styles.teamText}>{driver2.team_name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress / Loading Indicator */}
          {isLoading && (
            <div className={`${styles.statusBanner} ${styles.loading}`}>
              <div className={styles.spinner} />
              <span>{statusMessage || 'Communicating with OpenF1 API...'}</span>
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className={`${styles.statusBanner} ${styles.error}`}>
              <div className={styles.errorContent}>
                <span>⚠️ {errorMessage}</span>
                <button
                  type="button"
                  className={styles.errorActionBtn}
                  onClick={handleInstantMonzaDemo}
                >
                  ⚡ Load Verified Monza Benchmark
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <span className={styles.footerInfo}>
            Data Source: OpenF1 v1 Public Telemetry API
          </span>

          <div className={styles.actionButtons}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.loadBtn}
              onClick={handleIngestLiveTelemetry}
              disabled={isLoading || !driver1 || !driver2}
            >
              {isLoading ? 'Ingesting Data...' : 'Ingest & Compare Telemetry'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SessionExplorer;
