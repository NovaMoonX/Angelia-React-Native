import { ANGELIA_WEB_BASE_URL } from '@/models/constants';

export function getConnectionDeepLink(userId: string): string {
  return `angelia://connect-request?from=${encodeURIComponent(userId)}`;
}

export function getConnectionShareLink(userId: string): string {
  return `${ANGELIA_WEB_BASE_URL}/connect?from=${encodeURIComponent(userId)}`;
}

export function getInviteDeepLink(channelId: string, inviteCode: string): string {
  return `angelia://invite/${encodeURIComponent(channelId)}/${encodeURIComponent(inviteCode)}`;
}

export function getInviteShareLink(channelId: string, inviteCode: string): string {
  return `${ANGELIA_WEB_BASE_URL}/invite/${encodeURIComponent(channelId)}/${encodeURIComponent(inviteCode)}`;
}

export function parseConnectionLink(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol === 'angelia:' && url.hostname === 'connect-request') {
      return url.searchParams.get('from');
    }

    if (url.origin === ANGELIA_WEB_BASE_URL && url.pathname === '/connect') {
      return url.searchParams.get('from');
    }
  } catch {
    return null;
  }

  return null;
}

export function parseInviteLink(value: string): { channelId: string; inviteCode: string } | null {
  try {
    const url = new URL(value);

    if (url.protocol === 'angelia:' && url.hostname === 'invite') {
      const parts = url.pathname.split('/').filter((part) => { return !!part; });
      if (parts.length >= 2) {
        return {
          channelId: decodeURIComponent(parts[0]),
          inviteCode: decodeURIComponent(parts[1]).toUpperCase(),
        };
      }
    }

    if (url.origin === ANGELIA_WEB_BASE_URL && url.pathname.startsWith('/invite/')) {
      const parts = url.pathname.split('/').filter((part) => { return !!part; });
      if (parts.length >= 3) {
        return {
          channelId: decodeURIComponent(parts[1]),
          inviteCode: decodeURIComponent(parts[2]).toUpperCase(),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}