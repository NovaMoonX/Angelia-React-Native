export function getConnectionDeepLink(userId: string): string {
  return `angelia://connect-request?from=${encodeURIComponent(userId)}`;
}

export function getInviteDeepLink(channelId: string, inviteCode: string): string {
  return `angelia://invite/${encodeURIComponent(channelId)}/${encodeURIComponent(inviteCode)}`;
}