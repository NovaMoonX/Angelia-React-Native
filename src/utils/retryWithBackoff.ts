/**
 * Retries an async function using a configurable back-off schedule.
 *
 * The first attempt runs immediately with no delay.  Each subsequent retry
 * waits for the corresponding entry in `retryDelaysMs` before trying again.
 * When all retries are exhausted the last error is re-thrown.
 *
 * Default schedule: immediate → 0 ms → 5 s → 10 s → 20 s
 * (5 total attempts: 1 initial + 4 retries)
 *
 * @example
 *   const token = await retryWithBackoff(() => messaging().getToken());
 *
 * @example Custom schedule (3 attempts)
 *   const data = await retryWithBackoff(fetchData, [1_000, 5_000]);
 */

/**
 * Delay (ms) between each retry attempt for the default schedule.
 * Array length determines the number of retries; total attempts = length + 1.
 * Index 0 = first retry (0 ms = immediate), index 1 = second retry (5 s), etc.
 */
export const DEFAULT_RETRY_DELAYS_MS = [0, 5_000, 10_000, 20_000];

type RetryWithBackoffOptions = {
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retryDelaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
  options: RetryWithBackoffOptions = {},
): Promise<T> {
  let lastError: unknown;
  const { shouldRetry } = options;

  // attempt 0 = first try (no pre-delay)
  // attempt 1..N = retries (wait retryDelaysMs[attempt-1] first)
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) {
      await wait(retryDelaysMs[attempt - 1]);
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const hasRetryRemaining = attempt < retryDelaysMs.length;
      if (!hasRetryRemaining) {
        break;
      }

      if (shouldRetry && !shouldRetry(err, attempt)) {
        throw err;
      }
    }
  }

  throw lastError;
}
