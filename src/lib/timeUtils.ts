import { formatDistanceToNowStrict, format, differenceInHours } from 'date-fns';

/**
 * Returns a human-friendly relative or absolute timestamp.
 * - Under 1 minute: "Just now"
 * - Under 24h: relative ("5m ago", "2h ago")
 * - Over 24h: absolute ("Oct 12, 4:30 PM")
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'Just now';

  const hoursDiff = differenceInHours(now, timestamp);

  if (hoursDiff < 24) {
    return formatDistanceToNowStrict(timestamp, { addSuffix: true });
  }

  return format(timestamp, 'MMM d, h:mm a');
}

/**
 * Returns a human-friendly "Xm left / Xh left / Xd left" string for a status.
 */
export function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'Expired';

  const minutes = Math.floor(remaining / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m left`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;

  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

/**
 * Returns an exact expiry string like "Expires today at 5:30 PM" or
 * "Expires Mon, Apr 18 at 5:30 PM" for multi-day statuses.
 */
export function formatExactExpiry(expiresAt: number): string {
  const now = new Date();
  const expiry = new Date(expiresAt);

  const timeStr = expiry.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isSameDay =
    expiry.getDate() === now.getDate() &&
    expiry.getMonth() === now.getMonth() &&
    expiry.getFullYear() === now.getFullYear();

  if (isSameDay) return `Expires today at ${timeStr}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    expiry.getDate() === tomorrow.getDate() &&
    expiry.getMonth() === tomorrow.getMonth() &&
    expiry.getFullYear() === tomorrow.getFullYear();

  if (isTomorrow) return `Expires tomorrow at ${timeStr}`;

  const dateStr = expiry.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `Expires ${dateStr} at ${timeStr}`;
}
