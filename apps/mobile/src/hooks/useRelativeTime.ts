import { useState, useEffect } from 'react';
import { getRelativeTime } from '@/lib/timeUtils';

/**
 * Returns a human-friendly relative timestamp string that automatically
 * updates every 30 seconds so the display stays accurate without a state change.
 */
export function useRelativeTime(timestamp: number): string {
  const [label, setLabel] = useState(() => { return getRelativeTime(timestamp); });

  useEffect(() => {
    // Recompute immediately when the post timestamp changes so recycled list
    // rows never keep another post's stale time label until the next interval.
    setLabel(getRelativeTime(timestamp));

    const interval = setInterval(() => {
      setLabel(getRelativeTime(timestamp));
    }, 30_000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return label;
}
