import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './SessionSelector.module.scss';
import { useTelemetry } from '../../context/useTelemetry';
import { PRECOMPUTED_SESSION } from '../../mock/telemetryGenerator';
import { loadMonzaRealSession } from '../../services/openF1Service';
import { parseTelemetryData } from '../../utils/telemetryParser';
import { SessionExplorer } from '../SessionExplorer/SessionExplorer';

export const SessionSelector: React.FC = () => {
  const { session, switchSession } = useTelemetry();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCustomOrLive = session.id !== 'benchmark-demo' && session.id !== 'monza-real-f1';

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === session.id) {
      return;
    }
    if (val === 'benchmark-demo') {
      switchSession(PRECOMPUTED_SESSION);
    } else if (val === 'monza-real-f1') {
      const realSession = await loadMonzaRealSession();
      switchSession(realSession);
    } else if (val === 'open-explorer') {
      setIsExplorerOpen(true);
      e.target.value = session.id;
    } else if (val === 'import-modal') {
      setIsImportModalOpen(true);
      e.target.value = session.id;
    }
  };

  const processFile = useCallback(
    (file: File) => {
      setErrorMessage(null);
      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) {
          setErrorMessage('Empty file content');
          return;
        }

        const res = parseTelemetryData(text, file.name);
        if (res.session) {
          switchSession(res.session);
          setIsImportModalOpen(false);
        } else {
          setErrorMessage(res.error || 'Failed to parse telemetry file');
        }
      };

      reader.onerror = () => {
        setErrorMessage('Failed to read file from disk');
      };

      reader.readAsText(file);
    },
    [switchSession]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]!);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]!);
    }
  };

  return (
    <div className={styles.selectorContainer}>
      <select
        className={styles.selectorDropdown}
        value={session.id}
        onChange={handleSelectChange}
        title="Switch Telemetry Session"
      >
        {isCustomOrLive && (
          <option value={session.id}>
            {session.isRealData ? `[LIVE F1] ${session.name}` : `[CUSTOM] ${session.name}`}
          </option>
        )}
        <option value="benchmark-demo">[DEMO] Monza Benchmark (Offline Spec Racer)</option>
        <option value="monza-real-f1">[DEMO] Monza GP 2024 Q3 (Bundled Real Data)</option>
        <option value="open-explorer">OpenF1 Session Explorer (Live API)...</option>
        <option value="import-modal">Import Telemetry File (.json, .csv)...</option>
      </select>

      {/* Button to open OpenF1 Session Explorer modal */}
      <button
        type="button"
        className={styles.explorerTriggerBtn}
        onClick={() => setIsExplorerOpen(true)}
        title="Open OpenF1 Session Explorer modal to search meetings, sessions, and drivers"
      >
        <span className={styles.globeIcon}>🌐</span>
        <span>OpenF1 Explorer</span>
      </button>

      {/* Button to open Drag & Drop file import modal */}
      <button
        type="button"
        className={styles.importBtn}
        onClick={() => setIsImportModalOpen(true)}
        title="Open Telemetry File Ingestion Modal"
      >
        <span className={styles.uploadIcon}>⬆</span>
        <span>Import File</span>
      </button>

      {/* Live OpenF1 Session Explorer Modal */}
      <SessionExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
      />

      {/* Modal Dialog for Drag & Drop File Ingestion */}
      {isImportModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.modalBackdrop} onClick={() => setIsImportModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>Import Telemetry Data</span>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setIsImportModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className={styles.modalBody}>
                <div
                  className={`${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".json,.csv"
                    onChange={handleFileInputChange}
                  />
                  <div className={styles.dropzoneIcon}>📁</div>
                  <div className={styles.dropzoneText}>
                    Drag & drop telemetry file here, or click to browse
                  </div>
                  <div className={styles.dropzoneSub}>
                    Supports standard JSON telemetry sessions or CSV data channels
                  </div>
                </div>

                {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default SessionSelector;
