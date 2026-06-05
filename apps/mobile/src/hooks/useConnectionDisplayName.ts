import { useAppSelector } from '@/store/hooks';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { selectConnectionNicknamesMap } from '@/store/slices/connectionNicknamesSlice';
import { resolveConnectionDisplayName, type DisplayNameFormat } from '@/lib/user/user.utils';

export function useConnectionDisplayName(userId: string, format: DisplayNameFormat = 'full'): string {
  const currentUserId = useAppSelector((state) => state.users.currentUser?.id ?? null);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const nicknamesMap = useAppSelector(selectConnectionNicknamesMap);
  return resolveConnectionDisplayName(userId, usersMap[userId], currentUserId, nicknamesMap, format);
}
