import type { Channel, PublicChannelInvitePreview } from '@/models/types';

/** Minimal Channel for pending-invite / join-request flows from a public preview doc. */
export function channelFromPublicInvitePreview(preview: PublicChannelInvitePreview): Channel {
  return {
    id: preview.channelId,
    name: preview.name,
    description: preview.description,
    color: 'INDIGO',
    isDaily: false,
    isPrivate: false,
    ownerId: preview.ownerId,
    subscribers: [],
    inviteCode: preview.inviteCode,
    createdAt: 0,
    markedForDeletionAt: null,
  };
}
