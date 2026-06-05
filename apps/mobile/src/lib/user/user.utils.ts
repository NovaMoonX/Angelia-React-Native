import type { User } from '@/models/types';

/** Format variants for display name presentation. */
export type DisplayNameFormat = 'full' | 'first-last-initial' | 'initials';

/**
 * Returns a display name for a user.
 *
 * @param user - The user object (or null/undefined for unknown users).
 * @param currentUserId - The ID of the currently authenticated user.
 * @param userId - The ID of the user whose name should be returned.
 * @param format - How the name should be formatted:
 *   - `'full'` → "FirstName LastName"
 *   - `'first-last-initial'` → "FirstName L." (default)
 *   - `'initials'` → "FL"
 */
function formatDisplayNameFromProfile(
  user: Pick<User, 'firstName' | 'lastName'>,
  format: DisplayNameFormat,
): string {
  const { firstName, lastName } = user;

  switch (format) {
    case 'full':
      return `${firstName} ${lastName}`.trim();
    case 'first-last-initial':
      return lastName ? `${firstName} ${lastName[0]}.` : firstName;
    case 'initials': {
      const f = firstName.length > 0 ? firstName[0] : '';
      const l = lastName.length > 0 ? lastName[0] : '';
      return `${f}${l}`.toUpperCase() || '?';
    }
  }
}

function formatNickname(nickname: string, format: DisplayNameFormat): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';

  switch (format) {
    case 'full':
    case 'first-last-initial':
      return trimmed;
    case 'initials': {
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase() || '?';
      }
      return trimmed.slice(0, 2).toUpperCase() || '?';
    }
  }
}

export function getUserDisplayName(
  user: Pick<User, 'firstName' | 'lastName'> | null | undefined,
  currentUserId: string | null | undefined,
  userId: string,
  format: DisplayNameFormat = 'first-last-initial',
): string {
  if (userId === currentUserId) return 'You';
  if (!user) return '?';
  return formatDisplayNameFromProfile(user, format);
}

/**
 * Returns a display name for a user, applying a private connection nickname
 * override when one exists for the viewer.
 */
export function resolveConnectionDisplayName(
  userId: string,
  user: Pick<User, 'firstName' | 'lastName'> | null | undefined,
  currentUserId: string | null | undefined,
  nicknamesMap: Record<string, string>,
  format: DisplayNameFormat = 'full',
): string {
  if (userId === currentUserId) return 'You';

  const nickname = nicknamesMap[userId]?.trim();
  if (nickname) {
    return formatNickname(nickname, format);
  }

  return getUserDisplayName(user, currentUserId, userId, format);
}

/** Resolves a push/toast actor name with private nickname override when available. */
export function resolveNotificationActorName(
  actorUserId: string | undefined,
  nicknamesMap: Record<string, string>,
  fallbackFirstName: string,
  fallbackLastName = '',
): string {
  if (actorUserId) {
    const nickname = nicknamesMap[actorUserId]?.trim();
    if (nickname) return nickname;
  }
  const full = `${fallbackFirstName} ${fallbackLastName}`.trim();
  return full || fallbackFirstName || 'Someone';
}

/** Returns the legal full name for a user profile. */
export function getLegalFullName(
  user: Pick<User, 'firstName' | 'lastName'> | null | undefined,
): string {
  if (!user) return '';
  return `${user.firstName} ${user.lastName}`.trim();
}
