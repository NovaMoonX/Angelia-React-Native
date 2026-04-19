export type AvatarPreset =
  | 'astronaut' | 'moon' | 'star' | 'galaxy' | 'nebula' | 'planet'
  | 'cosmic-cat' | 'dream-cloud' | 'rocket' | 'constellation' | 'comet' | 'twilight'
  | 'aurora' | 'supernova' | 'lunar-moth' | 'satellite' | 'alien' | 'black-hole';

export interface UserStatus {
  emoji: string;
  text: string;
  updatedAt: number;
  expiresAt: number;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  funFact: string;
  avatar: AvatarPreset;
  /** Firebase Storage download URL for a custom profile photo. When set, takes precedence over `avatar`. */
  avatarUrl?: string;
  joinedAt: number;
  accountProgress: {
    signUpComplete: boolean;
    emailVerified: boolean;
    dailyChannelCreated: boolean;
  };
  customChannelCount: number;
  status: UserStatus | null;
  channelTierPrefs?: Record<string, PostTier[]>;
}

export type NewUser = Omit<User, 'joinedAt' | 'accountProgress' | 'customChannelCount' | 'status'>;

export interface FcmTokenEntry {
  /** Stable per-device ID stored locally in AsyncStorage. */
  deviceId: string;
  /** FCM registration token. */
  token: string;
  /** Human-friendly device name from expo-device (e.g. "iPhone 15 Pro"). */
  deviceName?: string;
}

export interface NotificationSettings {
  fcmTokens: FcmTokenEntry[];
  dailyPrompt: {
    enabled: boolean;
    /** Hour of day (0–23) in the user's chosen timezone. Default: 12 (noon). */
    hour: number;
    /** Minute (0–59) within the hour. Default: 0. */
    minute: number;
  };
  /**
   * Evening wind-down prompt. Fires after the user's busy period ends.
   * Defaults to 30 minutes after the busyEnd hour (e.g. 17:30 for a 9–17 schedule).
   */
  windDownPrompt: {
    enabled: boolean;
    /** Hour of day (0–23) in the user's chosen timezone. Default: 17. */
    hour: number;
    /** Minute (0–59). Default: 30. */
    minute: number;
  };
  /** IANA timezone string, e.g. "America/New_York". Default: device timezone. */
  timeZone: string;
  /**
   * When true, the reminder always fires in the device's current timezone.
   * The stored `timeZone` is kept in sync automatically on each sign-in.
   * Default: true.
   */
  autoDetectTimeZone: boolean;
}
export type UpdateUserProfileData = Pick<User, 'firstName' | 'lastName' | 'funFact' | 'avatar'> & {
  avatarUrl?: string | null;
};

/**
 * Partial update shape for notification settings.  The `dailyPrompt` sub-object
 * is itself partial so callers can update individual fields (e.g. just `enabled`)
 * without supplying all three fields every time.
 */
export type NotificationSettingsUpdate =
  Partial<Omit<NotificationSettings, 'fcmTokens' | 'dailyPrompt' | 'windDownPrompt'>> & {
    dailyPrompt?: Partial<NotificationSettings['dailyPrompt']>;
    windDownPrompt?: Partial<NotificationSettings['windDownPrompt']>;
  };

export interface Channel {
  id: string;
  name: string;
  description: string;
  color: string;
  isDaily: boolean | null;
  ownerId: string;
  subscribers: string[];
  inviteCode: string | null;
  createdAt: number;
  markedForDeletionAt: number | null;
}

export type NewChannel = Omit<Channel, 'id' | 'isDaily' | 'inviteCode' | 'createdAt' | 'markedForDeletionAt'>;

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  /** For videos: Firebase Storage download URL of the thumbnail image. */
  thumbnailUrl?: string;
}

export interface Reaction {
  emoji: string;
  userId: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
}

export type PostStatus = 'uploading' | 'ready' | 'error';

export type PostTier = 'everyday' | 'worth-knowing' | 'big-news';

export interface Post {
  id: string;
  authorId: string;
  channelId: string;
  text: string;
  media: MediaItem[] | null;
  timestamp: number;
  reactions: Reaction[];
  comments: Comment[];
  conversationEnrollees: string[];
  markedForDeletionAt: number | null;
  status: PostStatus;
  tier?: PostTier;
}

export interface ChannelJoinRequest {
  id: string;
  channelId: string;
  channelOwnerId: string;
  requesterId: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt: number | null;
}

export interface Message {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
  parentId: string | null;
  reactions: Record<string, string[]>;
  /** System messages (e.g. "joined with 🎉") have no real author interaction. */
  isSystem?: boolean;
}

export interface ChannelColorOption {
  name: string;
  value: string;
  textColor: string;
}

// ── App Notifications (Firestore-triggered FCM) ────────────────────────────

export type AppNotificationType =
  | 'join_channel_request'
  | 'join_channel_accepted'
  | 'new_post'        // For post tier subscriptions (future)
  | 'comment_reply';  // For conversation enrollment (future)

/**
 * Describes where a notification should be delivered.
 *
 * - `user`         — a single specific user (e.g. a join request to the channel owner)
 * - `channel_tier` — all subscribers of a post tier in a channel (e.g. a new post)
 * - `thread`       — all participants of a conversation thread (e.g. a reply)
 */
export type NotificationTarget =
  | { type: 'user'; userId: string }
  | { type: 'channel_tier'; channelId: string; tier: PostTier }
  | { type: 'thread'; threadId: string };

interface BaseAppNotification {
  id: string;
  type: AppNotificationType;
  /** The user who triggered the notification (e.g. the requester or the owner). */
  actorId: string;
  /** Where the notification should be delivered. */
  target: NotificationTarget;
  createdAt: number;
}

/** Written when a user requests to join a channel — targets the channel owner. */
export interface JoinChannelRequestNotification extends BaseAppNotification {
  type: 'join_channel_request';
  requesterId: string;
  requesterFirstName: string;
  requesterLastName: string;
  channelId: string;
  channelName: string;
  joinRequestId: string;
}

/** Written when the owner accepts a join request — targets the requester. */
export interface JoinChannelAcceptedNotification extends BaseAppNotification {
  type: 'join_channel_accepted';
  channelId: string;
  channelName: string;
  joinRequestId: string;
}

export type AppNotification = JoinChannelRequestNotification | JoinChannelAcceptedNotification;
