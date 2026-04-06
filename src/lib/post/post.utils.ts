import type { User } from '@/models/types';

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
