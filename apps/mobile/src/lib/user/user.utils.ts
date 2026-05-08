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
export function getUserDisplayName(
  user: Pick<User, 'firstName' | 'lastName'> | null | undefined,
  currentUserId: string | null | undefined,
  userId: string,
  format: DisplayNameFormat = 'first-last-initial',
): string {
  if (userId === currentUserId) return 'You';
  if (!user) return '?';

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
