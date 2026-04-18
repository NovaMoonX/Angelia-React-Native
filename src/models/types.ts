export type AvatarPreset =
  | 'astronaut' | 'moon' | 'star' | 'galaxy' | 'nebula' | 'planet'
  | 'cosmic-cat' | 'dream-cloud' | 'rocket' | 'constellation' | 'comet' | 'twilight';

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
  /** IANA timezone string, e.g. "America/New_York". Default: device timezone. */
  timeZone: string;
  /**
   * When true, the reminder always fires in the device's current timezone.
   * The stored `timeZone` is kept in sync automatically on each sign-in.
   * Default: true.
   */
  autoDetectTimeZone: boolean;
}
export type UpdateUserProfileData = Pick<User, 'firstName' | 'lastName' | 'funFact' | 'avatar'>;

/**
 * Partial update shape for notification settings.  The `dailyPrompt` sub-object
 * is itself partial so callers can update individual fields (e.g. just `enabled`)
 * without supplying all three fields every time.
 */
export type NotificationSettingsUpdate =
  Partial<Omit<NotificationSettings, 'fcmTokens' | 'dailyPrompt'>> & {
    dailyPrompt?: Partial<NotificationSettings['dailyPrompt']>;
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

export type AppNotificationType = 'join_channel_request' | 'join_channel_accepted';

interface BaseAppNotification {
  id: string;
  type: AppNotificationType;
  /** UID of the user who should receive the push notification. */
  targetUserId: string;
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
