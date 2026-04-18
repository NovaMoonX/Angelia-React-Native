import { formatDistanceToNowStrict, format, differenceInHours } from 'date-fns';

/**
 * Formats a message timestamp following the conversation spec:
 * - Under 24h: relative ("2h ago")
 * - Over 24h: absolute ("Oct 12, 4:30 PM")
 */
export function formatMessageTimestamp(timestamp: number): string {
  const now = Date.now();
  const hoursDiff = differenceInHours(now, timestamp);

  if (hoursDiff < 24) {
    return formatDistanceToNowStrict(timestamp, { addSuffix: true });
  }

  return format(timestamp, 'MMM d, h:mm a');
}
