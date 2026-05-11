import React, { useEffect, useRef, useState } from 'react';
import { AppUpdateDialog, AppUpdatePhase, ProgressInfo } from './AppUpdateDialog';
import { DatabaseUpdateDialog } from './DatabaseUpdateDialog';
import {
  AutoUpdateEvent,
  DatabaseStartupCheckResult,
  ipc,
} from '../DocPanel/docApi';

/**
 * Drives the app-update -> database-update sequence on startup.
 *
 * The native Electron dialogs the auto-updater and the database checker
 * used previously didn't coordinate, which meant the user could see both
 * stacked on top of each other (or get the database one while the auto-
 * updater was still downloading). This component owns the order:
 *
 *   1. Trigger autoUpdate:check.
 *   2. Show AppUpdateDialog through every relevant phase:
 *        available → progress → downloaded → (Restart now | Later) | error.
 *   3. When the app phase is "done" (user dismissed, no update, error,
 *      dev mode), then call database:startupCheck.
 *   4. If the database is behind, show DatabaseUpdateDialog with the same
 *      three options the native message box offered (Download now / Later
 *      / Don't ask again).
 *
 * Mount once, near the top of the renderer tree. Idle/non-event states
 * render nothing so the component is invisible until it has something
 * to say.
 */
type AppPhase =
  /** Subscribed, asked main to check, waiting for the first event. */
  | { kind: 'waiting' }
  /** electron-updater is checking. */
  | { kind: 'checking' }
  /** Update available, downloading. */
  | {
      kind: 'available';
      info: Extract<AutoUpdateEvent, { kind: 'available' }>['info'];
      progress?: ProgressInfo;
    }
  /** Update downloaded, prompting for restart. */
  | {
      kind: 'downloaded';
      info: Extract<AutoUpdateEvent, { kind: 'downloaded' }>['info'];
    }
  /** Update check failed; show an OK dialog and move on. */
  | { kind: 'error'; message: string }
  /** App-update phase finished (dev mode, no update, dismissed, error
   *  acknowledged) — orchestrator is free to run the database step. */
  | { kind: 'done' };

type DbPhase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | {
      kind: 'available';
      result: Extract<DatabaseStartupCheckResult, { kind: 'update-available' }>;
    }
  | { kind: 'done' };

export default function UpdateOrchestrator(): JSX.Element | null {
  const [appPhase, setAppPhase] = useState<AppPhase>({ kind: 'waiting' });
  const [dbPhase, setDbPhase] = useState<DbPhase>({ kind: 'idle' });

  // Guards re-entry — StrictMode mounts effects twice in dev.
  const startedRef = useRef(false);
  const dbStartedRef = useRef(false);

  // 1) Subscribe + kick off the auto-update check.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const unsub = ipc()?.onAutoUpdateEvent((evt) => {
      switch (evt.kind) {
        case 'disabled':
          // Dev mode or autoUpdater couldn't even start — skip straight
          // to the database step.
          setAppPhase({ kind: 'done' });
          break;
        case 'checking':
          setAppPhase({ kind: 'checking' });
          break;
        case 'available':
          setAppPhase({ kind: 'available', info: evt.info });
          break;
        case 'progress':
          setAppPhase((prev) =>
            prev.kind === 'available'
              ? {
                  ...prev,
                  progress: {
                    percent: evt.percent,
                    bytesPerSecond: evt.bytesPerSecond,
                    transferred: evt.transferred,
                    total: evt.total,
                  },
                }
              : prev,
          );
          break;
        case 'downloaded':
          setAppPhase({ kind: 'downloaded', info: evt.info });
          break;
        case 'not-available':
          setAppPhase({ kind: 'done' });
          break;
        case 'error':
          setAppPhase({ kind: 'error', message: evt.message });
          break;
      }
    });

    (async () => {
      const res = await ipc()?.autoUpdateCheck();
      if (!res) return;
      if (res.ok === false) {
        setAppPhase({ kind: 'error', message: res.message });
      }
      // ok=true and started=false means dev mode — main will already have
      // sent us a 'disabled' event so we don't have to do anything here.
    })();

    return () => {
      unsub?.();
    };
  }, []);

  // 2) Once the app phase is done, run the database check (once).
  useEffect(() => {
    if (appPhase.kind !== 'done') return;
    if (dbStartedRef.current) return;
    dbStartedRef.current = true;

    (async () => {
      setDbPhase({ kind: 'checking' });
      const res = await ipc()?.databaseStartupCheck();
      if (!res) {
        setDbPhase({ kind: 'done' });
        return;
      }
      if (res.kind === 'update-available') {
        setDbPhase({ kind: 'available', result: res });
      } else {
        // disabled / up-to-date / error → silently move on.
        setDbPhase({ kind: 'done' });
      }
    })();
  }, [appPhase]);

  // ---- App dialog ----
  const renderedAppPhase: AppUpdatePhase | null = (() => {
    if (appPhase.kind === 'available') {
      return {
        kind: 'available',
        info: appPhase.info,
        progress: appPhase.progress,
      };
    }
    if (appPhase.kind === 'downloaded') {
      return { kind: 'downloaded', info: appPhase.info };
    }
    if (appPhase.kind === 'error') {
      return { kind: 'error', message: appPhase.message };
    }
    return null;
  })();

  const handleAppInstall = async () => {
    await ipc()?.autoUpdateQuitAndInstall();
    // If quitAndInstall fails for any reason, move on so we don't get stuck.
    setAppPhase({ kind: 'done' });
  };
  const handleAppDismiss = () => {
    setAppPhase({ kind: 'done' });
  };

  // ---- Database dialog ----
  const dbDialog =
    dbPhase.kind === 'available' ? (
      <DatabaseUpdateDialog
        remote={dbPhase.result.remote}
        sourceId={dbPhase.result.sourceId}
        sourceDisplayName={dbPhase.result.sourceDisplayName}
        localTag={dbPhase.result.localTag}
        localDbVersion={dbPhase.result.localDbVersion}
        onLater={() => setDbPhase({ kind: 'done' })}
        onDontAskAgain={() => setDbPhase({ kind: 'done' })}
        onCompleted={() => setDbPhase({ kind: 'done' })}
      />
    ) : null;

  return (
    <>
      <AppUpdateDialog
        phase={renderedAppPhase}
        onInstallNow={handleAppInstall}
        onDismiss={handleAppDismiss}
      />
      {dbDialog}
    </>
  );
}
