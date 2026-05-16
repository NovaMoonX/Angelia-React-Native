import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppSelector } from '@/store/hooks';
import {
  useDataListenerLifecycle,
  useDataListenerNotifications,
  useDataListenerRealtimeData,
} from '@/hooks/dataListeners';

interface DataListenerWrapperProps {
  children: ReactNode;
}

export function DataListenerWrapper({ children }: DataListenerWrapperProps) {
  const { firebaseUser } = useAuth();
  const currentUserId = useAppSelector((state) => {
    return state.users.currentUser?.id ?? null;
  });
  const isDemo = useAppSelector((state) => {
    return state.demo.isActive;
  });

  useDataListenerRealtimeData();
  useDataListenerNotifications();
  useDataListenerLifecycle({
    currentUserId,
    hasFirebaseUser: Boolean(firebaseUser),
    isDemo,
  });

  return <>{children}</>;
}
