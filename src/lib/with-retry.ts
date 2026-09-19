/** Wraps a Firestore (or any async) call with automatic retries for
 *  transient network failures — the same class of brief timeout/DNS
 *  blip we've hit repeatedly against Google's APIs. Retries up to
 *  `attempts` times with a short delay between tries before finally
 *  throwing, so a page only shows an error if the problem genuinely
 *  doesn't clear on its own. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  throw lastErr;
}