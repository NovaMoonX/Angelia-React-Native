import { useContext } from 'react';
import {
  AuthorPostActivityContext,
  type AuthorPostActivityValue,
  type PostUnreadDetail,
} from '@/providers/AuthorPostActivityProvider';

export type { PostUnreadDetail };

export function useAuthorPostActivity(): AuthorPostActivityValue {
  const context = useContext(AuthorPostActivityContext);
  if (!context) {
    throw new Error('useAuthorPostActivity must be used within an AuthorPostActivityProvider');
  }
  return context;
}
