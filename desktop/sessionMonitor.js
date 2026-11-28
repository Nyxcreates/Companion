/**
 * Companion Desktop — Local Long-Session Tracker
 *
 * Opt-in, OFF by default.
 * Uses Electron's `powerMonitor.getSystemIdleTime()` locally to estimate
 * continuous active computer time.
 *
 * Privacy guarantees:
 *  - No screen capture
 *  - No app names or window titles
 *  - No keystroke logging
 *  - Nothing sent to any server while tracking; only emits a local trigger
 *    when the chosen continuous-active threshold is reached.
 */

const IDLE_ACTIVE_THRESHOLD_SECONDS = 120; // < 2 min idle counts as active
const IDLE_BREAK_RESET_SECONDS = 300; // >= 5 min idle resets continuous counter
const TICK_INTERVAL_MS = 60_000;
const MIN_TRIGGER_COOLDOWN_MS = 10 * 60_000;

class LocalSessionMonitor {
  /**
   * @param {object} options
   * @param {() => number} options.getSystemIdleTime
   * @param {() => { enabled: boolean, intervalMinutes: number }} options.getConfig
   * @param {() => boolean} options.canTrigger
   * @param {(payload: { activeMinutes: number }) => void} options.onThresholdReached
   */
  constructor(options) {
    this.getSystemIdleTime = options.getSystemIdleTime;
    this.getConfig = options.getConfig;
    this.canTrigger = options.canTrigger;
    this.onThresholdReached = options.onThresholdReached;

    this.activeSeconds = 0;
    this.lastTriggeredAt = 0;
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  reset() {
    this.activeSeconds = 0;
  }

  tick(nowMs = Date.now()) {
    const cfg = this.getConfig();
    if (!cfg.enabled) {
      this.activeSeconds = 0;
      return false;
    }

    let idleSeconds = 0;
    try {
      idleSeconds = Number(this.getSystemIdleTime()) || 0;
    } catch {
      return false;
    }

    if (idleSeconds >= IDLE_BREAK_RESET_SECONDS) {
      this.activeSeconds = 0;
      return false;
    }

    if (idleSeconds < IDLE_ACTIVE_THRESHOLD_SECONDS) {
      this.activeSeconds += 60;
    }

    const intervalMinutes = Math.max(15, Math.min(240, Number(cfg.intervalMinutes) || 90));
    if (this.activeSeconds < intervalMinutes * 60) {
      return false;
    }

    if (nowMs - this.lastTriggeredAt < MIN_TRIGGER_COOLDOWN_MS) {
      return false;
    }

    if (typeof this.canTrigger === "function" && !this.canTrigger()) {
      return false;
    }

    const activeMinutes = Math.round(this.activeSeconds / 60);
    this.lastTriggeredAt = nowMs;
    this.activeSeconds = 0;
    this.onThresholdReached({ activeMinutes });
    return true;
  }
}

module.exports = {
  LocalSessionMonitor,
  IDLE_ACTIVE_THRESHOLD_SECONDS,
  IDLE_BREAK_RESET_SECONDS,
};
