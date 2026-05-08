import { useState, useEffect } from 'react';
import { getRelativeTime } from '@/lib/timeUtils';

/**
 * Returns a human-friendly relative timestamp string that automatically
 * updates every 30 seconds so the display stays accurate without a state change.
 */
export function useRelativeTime(timestamp: number): string {
  const [label, setLabel] = useState(() => { return getRelativeTime(timestamp); });

  useEffect(() => {
    const interval = setInterval(() => {
      setLabel(getRelativeTime(timestamp));
    }, 30_000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return label;
}
