export type PendingWriteScope = 'reaction' | 'conversationJoin' | 'message';

const locksByPost = new Map<string, Set<PendingWriteScope>>();

function getLockSet(postId: string): Set<PendingWriteScope> {
  let set = locksByPost.get(postId);
  if (!set) {
    set = new Set();
    locksByPost.set(postId, set);
  }
  return set;
}

export function acquirePendingWrite(postId: string, scope: PendingWriteScope): void {
  getLockSet(postId).add(scope);
}

export function releasePendingWrite(postId: string, scope: PendingWriteScope): void {
  const set = locksByPost.get(postId);
  if (!set) {
    return;
  }
  set.delete(scope);
  if (set.size === 0) {
    locksByPost.delete(postId);
  }
}

export function isPendingWriteLocked(
  postId: string,
  scope?: PendingWriteScope,
): boolean {
  const set = locksByPost.get(postId);
  if (!set || set.size === 0) {
    return false;
  }
  if (!scope) {
    return true;
  }
  return set.has(scope);
}
