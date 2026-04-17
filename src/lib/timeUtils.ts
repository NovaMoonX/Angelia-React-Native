export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
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
