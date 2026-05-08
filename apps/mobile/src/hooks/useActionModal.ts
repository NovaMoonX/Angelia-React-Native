import { useContext } from 'react';
import { ActionModalContext } from '@/providers/ActionModalProvider';

export function useActionModal() {
  return useContext(ActionModalContext);
}
