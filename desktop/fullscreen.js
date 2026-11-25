/**
 * Companion Desktop — Full-Screen & Windows Quiet-Time Detector
 *
 * Uses Windows' official SHQueryUserNotificationState API (shell32.dll)
 * to detect:
 *   - QUNS_BUSY (2)                    → Full-screen app / presentation
 *   - QUNS_RUNNING_D3D_FULL_SCREEN (3) → Full-screen Direct3D game
 *   - QUNS_PRESENTATION_MODE (4)       → Presentation mode
 *   - QUNS_QUIET_TIME (6)              → Windows Focus Assist / Quiet Time
 *
 * Non-blocking, throttled, and safely falls back to false on errors
 * or non-Windows platforms.
 */

const { execFile } = require("child_process");

const PS_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class WinUserState {
  [DllImport("shell32.dll")]
  public static extern int SHQueryUserNotificationState(out int pquns);
  public static int Query() {
    int state = 0;
    int hr = SHQueryUserNotificationState(out state);
    return hr == 0 ? state : 5;
  }
}
"@
[WinUserState]::Query()
`.trim();

/**
 * Notification state codes returned by SHQueryUserNotificationState:
 *  1 = QUNS_NOT_PRESENT
 *  2 = QUNS_BUSY
 *  3 = QUNS_RUNNING_D3D_FULL_SCREEN
 *  4 = QUNS_PRESENTATION_MODE
 *  5 = QUNS_ACCEPTS_NOTIFICATIONS
 *  6 = QUNS_QUIET_TIME
 *  7 = QUNS_APP
 */
const SUPPRESSED_STATES = new Set([2, 3, 4, 6]);

class FullscreenDetector {
  /**
   * @param {object} [options]
   * @param {() => Promise<{ suppressed: boolean, quietTime: boolean, stateCode: number }>} [options.queryFn]
   */
  constructor(options = {}) {
    this.queryFn = options.queryFn || (() => this._queryWindowsState());
    this.inFlight = false;
    this.lastResult = { suppressed: false, quietTime: false, stateCode: 5 };
  }

  /**
   * Query current Windows notification/full-screen state.
   * Never throws; returns cached state if a query is already in flight.
   * @returns {Promise<{ suppressed: boolean, quietTime: boolean, stateCode: number }>}
   */
  async check() {
    if (this.inFlight) return this.lastResult;
    this.inFlight = true;
    try {
      const result = await this.queryFn();
      this.lastResult = result;
      return result;
    } catch {
      return this.lastResult;
    } finally {
      this.inFlight = false;
    }
  }

  /**
   * Executes the Windows SHQueryUserNotificationState check via PowerShell.
   * @returns {Promise<{ suppressed: boolean, quietTime: boolean, stateCode: number }>}
   */
  _queryWindowsState() {
    if (process.platform !== "win32") {
      return Promise.resolve({ suppressed: false, quietTime: false, stateCode: 5 });
    }

    return new Promise((resolve) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", PS_SCRIPT],
        { timeout: 3500, windowsHide: true },
        (err, stdout) => {
          if (err) {
            resolve({ suppressed: false, quietTime: false, stateCode: 5 });
            return;
          }
          const code = parseInt(String(stdout || "").trim(), 10);
          if (Number.isNaN(code)) {
            resolve({ suppressed: false, quietTime: false, stateCode: 5 });
            return;
          }
          resolve({
            suppressed: SUPPRESSED_STATES.has(code),
            quietTime: code === 6,
            stateCode: code,
          });
        }
      );
    });
  }
}

module.exports = { FullscreenDetector, SUPPRESSED_STATES };
