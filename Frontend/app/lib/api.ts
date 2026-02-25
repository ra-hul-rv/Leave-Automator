'use client';

/**
 * Smart API router that races both servers in parallel.
 *
 * Strategy:
 *   1. On module load both servers are pinged simultaneously.
 *      This wakes the Render free-tier instance while we wait for the primary.
 *   2. If the primary (api.rvcloud.in) responds → all traffic goes to primary.
 *   3. If the primary times out / fails → traffic falls back to Render.
 *   4. The resolved server is cached for the lifetime of the browser tab.
 *
 * In local development (hostname === 'localhost') localhost:8000 is used directly.
 */

const PRIMARY = 'https://api.rvcloud.in';
const BACKUP  = 'https://leave-automator.onrender.com';
const LOCAL   = 'http://localhost:8000';

const IS_DEV =
  typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Tab-scoped cached base URL. Set to LOCAL immediately when in dev.
let resolvedBase: string | null = IS_DEV ? LOCAL : null;
let resolutionPromise: Promise<string> | null = null;

/** Ping a server's health endpoint and resolve with its base URL, or reject on timeout/error. */
function ping(base: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${base} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(`${base}/health`, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        res.ok ? resolve(base) : reject(new Error(`${base} returned ${res.status}`));
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * One-time resolution: fires pings to both servers in parallel.
 * Primary gets an 8-second window; backup gets 60 seconds (Render cold start).
 */
function resolveBase(): Promise<string> {
  if (resolvedBase !== null) return Promise.resolve(resolvedBase);
  if (resolutionPromise)    return resolutionPromise;

  resolutionPromise = new Promise<string>((resolve) => {
    // Both fired at the same time — this is the key to waking Render early.
    const primaryPromise = ping(PRIMARY, 8_000);
    const backupPromise  = ping(BACKUP,  60_000);

    primaryPromise
      .then((base) => {
        resolvedBase = base;
        resolve(base);
      })
      .catch(() => {
        // Primary unavailable — fall back to whichever backup resolves to
        backupPromise
          .then((base) => {
            resolvedBase = base;
            resolve(base);
          })
          .catch(() => {
            // Both unreachable — let requests fail naturally with clear errors
            resolvedBase = PRIMARY;
            resolve(PRIMARY);
          });
      });
  });

  return resolutionPromise;
}

// Kick off resolution as soon as this module is imported (not in dev where it's instant).
if (typeof window !== 'undefined' && !IS_DEV) {
  resolveBase();
}

/**
 * Drop-in replacement for `fetch()` that automatically routes to the best
 * available server. Callers can inspect `res.ok` and `res.json()` as normal.
 */
export async function smartFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = await resolveBase();
  return fetch(`${base}${path}`, init);
}
