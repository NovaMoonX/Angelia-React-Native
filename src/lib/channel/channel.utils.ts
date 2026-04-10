import { CHANNEL_COLORS } from '@/models/constants';
import type { Channel } from '@/models/types';

export function getColorPair(channel: Channel): { backgroundColor: string; textColor: string } {
  const color = CHANNEL_COLORS.find((c) => c.name === channel.color);
  return {
    backgroundColor: color?.value || '#6366F1',
    textColor: color?.textColor || '#FFFFFF',
  };
}

export function generateChannelInviteLink(channel: Channel): string {
  if (!channel.inviteCode) return '';
  return `angelia://invite/${channel.id}/${channel.inviteCode}`;
}
