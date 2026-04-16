import { createAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

/**
 * Global action to reset all Redux state to initial values.
 * This action is handled by all slices to clear their respective state.
 *
 * Use this when:
 * - User signs out
 * - Clearing demo mode
 * - Resetting the application to a clean state
 */
export const resetAllState = createAction('RESET_ALL_STATE');

/**
 * Helper to check if demo mode is active from within a thunk.
 * Use this in action files to branch logic based on demo state,
 * so that consuming components don't need to check demo mode themselves.
 */
export function isDemoActive(getState: () => unknown): boolean {
  const state = getState() as RootState;
  return state.demo.isActive;
}
