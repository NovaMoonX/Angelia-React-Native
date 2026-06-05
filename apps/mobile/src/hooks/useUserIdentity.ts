import { useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import { getUserDisplayName, resolveConnectionDisplayName } from '@/lib/user/user.utils';
import { PSEUDONYM_AVATAR_PRESET } from '@/models/constants';
import type { AvatarPreset, Connection, User } from '@/models/types';

export interface ResolvedUserIdentity {
  displayName: string;
  avatarPreset: AvatarPreset;
  avatarUrl: string | null;
  connected: boolean;
  isSelf: boolean;
}

export type UserIdentityFields = Pick<
  User,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'publicDisplayName'
  | 'avatar'
  | 'avatarUrl'
  | 'hideNameFromNonConnections'
  | 'hideAvatarFromNonConnections'
>;

/**
 * Resolves how a user should appear to the current viewer.
 *
 * UI-layer masking only: real names remain in world-readable `usersPublic`.
 * Connected users and self always see the real profile.
 */
export function resolveUserIdentity(
  currentUserId: string | null | undefined,
  connections: Connection[],
  targetUser: UserIdentityFields | null | undefined,
  nicknamesMap: Record<string, string> = {},
): ResolvedUserIdentity {
  if (!targetUser) {
    return {
      displayName: 'Unknown',
      avatarPreset: PSEUDONYM_AVATAR_PRESET,
      avatarUrl: null,
      connected: false,
      isSelf: false,
    };
  }

  const isSelf = !!currentUserId && targetUser.id === currentUserId;
  const connected =
    isSelf ||
    connections.some((c) => c.userId === targetUser.id);

  if (connected) {
    const displayName = isSelf
      ? 'You'
      : resolveConnectionDisplayName(
          targetUser.id,
          targetUser,
          currentUserId,
          nicknamesMap,
          'full',
        );
    return {
      displayName,
      avatarPreset: targetUser.avatar,
      avatarUrl: targetUser.avatarUrl,
      connected: !isSelf,
      isSelf,
    };
  }

  const hideName = targetUser.hideNameFromNonConnections !== false;
  const hideAvatar = targetUser.hideAvatarFromNonConnections !== false;

  const displayName = hideName
    ? (targetUser.publicDisplayName?.trim() || 'Someone')
    : getUserDisplayName(targetUser, currentUserId, targetUser.id, 'full');

  return {
    displayName,
    avatarPreset: hideAvatar ? PSEUDONYM_AVATAR_PRESET : targetUser.avatar,
    avatarUrl: hideAvatar ? null : targetUser.avatarUrl,
    connected: false,
    isSelf: false,
  };
}

export function useUserIdentity(
  targetUserId: string | null | undefined,
  targetUser?: UserIdentityFields | null,
): ResolvedUserIdentity {
  const currentUserId = useAppSelector((state) => state.users.currentUser?.id);
  const connections = useAppSelector((state) => state.connections.connections);
  const nicknamesMap = useAppSelector((state) => state.connectionNicknames.nicknames);
  const users = useAppSelector((state) => state.users.users);

  const resolvedUser = useMemo(() => {
    if (targetUser) return targetUser;
    if (!targetUserId) return null;
    return users.find((u) => u.id === targetUserId) ?? null;
  }, [targetUser, targetUserId, users]);

  return useMemo(
    () => resolveUserIdentity(currentUserId, connections, resolvedUser, nicknamesMap),
    [currentUserId, connections, nicknamesMap, resolvedUser],
  );
}
