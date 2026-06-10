import type { Channel } from '@/models/types';
import { getUserDisplayName } from '@/lib/user/user.utils';
import type { User } from '@/models/types';

export interface GroupedNotificationCircle {
  ownerId: string;
  ownerLabel: string;
  circles: Array<{
    channel: Channel;
    displayName: string;
    subtitle: string;
  }>;
}

export function groupNotificationChannelsByOwner(
  channels: Channel[],
  usersById: Record<string, User>,
  currentUserId: string,
): GroupedNotificationCircle[] {
  const grouped = new Map<string, GroupedNotificationCircle>();

  channels.forEach((channel) => {
    const owner = usersById[channel.ownerId];
    const ownerLabel = getUserDisplayName(owner, currentUserId, channel.ownerId, 'first-last-initial');
    const existing = grouped.get(channel.ownerId) ?? {
      ownerId: channel.ownerId,
      ownerLabel,
      circles: [],
    };

    const displayName = channel.isDaily === true
      ? getUserDisplayName(owner, currentUserId, channel.ownerId, 'first-last-initial')
      : channel.name;

    existing.circles.push({
      channel,
      displayName,
      subtitle: channel.isDaily === true ? 'Daily Circle' : 'Custom Circle',
    });

    grouped.set(channel.ownerId, existing);
  });

  return Array.from(grouped.values())
    .map((group) => {
      const nextCircles = [...group.circles].sort((a, b) => {
        if (a.channel.isDaily === true && b.channel.isDaily !== true) {
          return -1;
        }
        if (a.channel.isDaily !== true && b.channel.isDaily === true) {
          return 1;
        }
        return a.displayName.localeCompare(b.displayName);
      });
      return {
        ...group,
        circles: nextCircles,
      };
    })
    .sort((a, b) => {
      return a.ownerLabel.localeCompare(b.ownerLabel);
    });
}

export function filterGroupedNotificationCircles(
  groups: GroupedNotificationCircle[],
  query: string,
): GroupedNotificationCircle[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return groups;
  }

  return groups
    .map((group) => {
      const ownerMatches = group.ownerLabel.toLowerCase().includes(normalized);
      const matchingCircles = group.circles.filter((entry) => {
        return (
          ownerMatches ||
          entry.displayName.toLowerCase().includes(normalized) ||
          entry.subtitle.toLowerCase().includes(normalized) ||
          entry.channel.name.toLowerCase().includes(normalized)
        );
      });

      if (matchingCircles.length === 0) {
        return null;
      }

      return {
        ...group,
        circles: matchingCircles,
      };
    })
    .filter((group): group is GroupedNotificationCircle => group != null);
}
