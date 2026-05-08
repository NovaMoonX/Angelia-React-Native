import type { User } from '@/models/types';
import {
  CUSTOM_POST_EXPIRY_WARNING_DAYS,
  CUSTOM_POST_RETENTION_DAYS,
  DAILY_POST_EXPIRY_WARNING_DAYS,
  DAILY_POST_RETENTION_DAYS,
} from '@/models/constants';

/**
 * Returns how many days are left before a post is deleted, if the post is
 * within the expiry-warning window. Returns `null` when the post is not yet
 * close to expiry.
 *
 * Retention periods (mirrors Cloud Function `deleteExpiredPosts`):
 *   - Daily Circle posts: 14 days
 *   - Custom Circle posts: 90 days
 */
export function getPostExpiryInfo(
  timestamp: number,
  isDaily: boolean,
): { daysLeft: number } | null {
  const retentionDays = isDaily ? DAILY_POST_RETENTION_DAYS : CUSTOM_POST_RETENTION_DAYS;
  const warningDays = isDaily ? DAILY_POST_EXPIRY_WARNING_DAYS : CUSTOM_POST_EXPIRY_WARNING_DAYS;

  const expiresAt = timestamp + retentionDays * 24 * 60 * 60 * 1000;
  const msLeft = expiresAt - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

  if (daysLeft <= warningDays) {
    return { daysLeft: Math.max(0, daysLeft) };
  }

  return null;
}

export function getPostAuthorName(
  author: User | undefined,
  currentUser: User | null
): string {
  if (!author) return 'Unknown';
  const name = `${author.firstName} ${author.lastName}`;
  if (currentUser && author.id === currentUser.id) {
    return `${name} (You)`;
  }
  return name;
}
