import { AppState, InteractionManager } from 'react-native';

const MAX_ATTEMPTS = 50;
const RETRY_MS = 100;

function waitForActiveAppState(): Promise<void> {
  if (AppState.currentState === 'active') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        subscription.remove();
        resolve();
      }
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retries a router.push until the root navigator is mounted or attempts are exhausted.
 */
export async function pushRouteWhenNavigatorReady(
  push: () => void,
  shouldAbort?: () => Promise<boolean>,
): Promise<boolean> {
  await waitForActiveAppState();

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      resolve();
    });
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (shouldAbort && (await shouldAbort())) {
      return false;
    }

    try {
      push();
      return true;
    } catch {
      await delay(RETRY_MS);
    }
  }

  return false;
}
