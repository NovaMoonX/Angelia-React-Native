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

/**
 * Public profile — readable by any authenticated user.
 * Stored at `usersPublic/{uid}`.
 */
export interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  avatar: AvatarPreset;
  /** Firebase Storage download URL for a custom profile photo. When set, takes precedence over `avatar`. */
  avatarUrl: string | null;
  joinedAt: number;
}

/**
 * Private profile — readable by other users (e.g. connected users / channel members).
 * Stored at `usersPrivate/{uid}`.
 */
export interface UserPrivate {
  email: string;
  funFact: string;
  status: UserStatus | null;
}

/**
 * Secret profile — readable only by the user themselves.
 * Stored at `usersSecret/{uid}`.
 */
export interface UserSecret {
  accountProgress: {
    signUpComplete: boolean;
    emailVerified: boolean;
    dailyChannelCreated: boolean;
  };
  customChannelCount: number;
}

/**
 * Merged user type used internally in Redux state.
 * Combines all three Firestore sub-documents into a single in-memory shape.
 */
export interface User extends UserPublic, UserPrivate, UserSecret {}

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
export type UpdateUserProfileData = Pick<UserPublic, 'firstName' | 'lastName' | 'avatar' | 'avatarUrl'> & Pick<UserPrivate, 'funFact'>

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

// ── Connections ────────────────────────────────────────────────────────────

/**
 * Represents a single connection between the owning user and another user.
 * Stored in `connections/{userId}/people/{connectedUserId}`.
 */
export interface Connection {
  /** The connected user's ID. */
  userId: string;
  /** Epoch ms when the connection was established. */
  connectedAt: number;
}

/**
 * A connection request sent from one user to another.
 * Stored in `connectionRequests/{requestId}`.
 */
export interface ConnectionRequest {
  id: string;
  /** The user who initiated the request (clicked the host's share link). */
  fromId: string;
  /** The user whose link was shared (the host). */
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt: number | null;
}

// ── App Notifications (Firestore-triggered FCM) ────────────────────────────

export type AppNotificationType =
  | 'join_channel_request'
  | 'join_channel_accepted'
  | 'connection_request'
  | 'connection_accepted'
  | 'big_news_post'
  | 'new_post'        // For post tier subscriptions (future)
  | 'comment_reply'   // For conversation enrollment (future)
  | 'private_note';   // A Circle member sent the post Host a private note

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

/** Written when a user sends a connection request — targets the host. */
export interface ConnectionRequestNotification extends BaseAppNotification {
  type: 'connection_request';
  fromId: string;
  fromFirstName: string;
  fromLastName: string;
  connectionRequestId: string;
}

/** Written when the host accepts a connection request — targets the requester. */
export interface ConnectionAcceptedNotification extends BaseAppNotification {
  type: 'connection_accepted';
  toFirstName: string;
  toLastName: string;
  connectionRequestId: string;
}

/**
 * Written when a big-news post is created in a daily circle (targets all connected users)
 * or in a custom circle (targets all circle members).
 * Target is always `channel_tier` so the Cloud Function fans out to all subscribers.
 */
export interface BigNewsPostNotification extends BaseAppNotification {
  type: 'big_news_post';
  postId: string;
  channelId: string;
  channelName: string;
  /** Whether the post is in a daily circle (true) or a custom circle (false). */
  isDaily: boolean;
  authorFirstName: string;
  authorLastName: string;
}

/** Written when a Circle member sends the post Host a private note — targets the host. */
export interface PrivateNoteNotification extends BaseAppNotification {
  type: 'private_note';
  /** The ID of the post the note is about. Used for deep-linking to the private-notes screen. */
  postId: string;
  /** First name of the note author (Circle member). */
  authorFirstName: string;
  /** Last name of the note author. */
  authorLastName: string;
}

export type AppNotification =
  | JoinChannelRequestNotification
  | JoinChannelAcceptedNotification
  | ConnectionRequestNotification
  | ConnectionAcceptedNotification
  | BigNewsPostNotification
  | PrivateNoteNotification;

// ── Tasks ───────────────────────────────────────────────────────────────────

/**
 * All task types surfaced to the user.
 * - `invite_to_circle`: invite someone to a custom Circle they just created.
 * - `set_fun_fact`: prompt user to fill in their profile bio.
 * - `set_status`: prompt user to set their first status.
 * - `create_custom_circle`: prompt user to create their first custom Circle.
 */
export type TaskType =
  | 'invite_to_circle'
  | 'set_fun_fact'
  | 'set_status'
  | 'create_custom_circle';

/**
 * A lightweight to-do item owned by a single user.
 * Stored in `tasks/{userId}/items/{taskId}`.
 *
 * `channelId` / `channelName` are only present for `invite_to_circle` tasks.
 */
export interface AppTask {
  id: string;
  userId: string;
  type: TaskType;
  /** Only set for `invite_to_circle`. */
  channelId?: string;
  /** Only set for `invite_to_circle`. */
  channelName?: string;
  createdAt: number;
  /** Non-null once the user marks the task done (or dismisses it). */
  completedAt: number | null;
}

// ── Private Notes ────────────────────────────────────────────────────────────

/**
 * A private note sent by a Circle member to the post Host.
 * Only the Host (post author) can read notes addressed to them.
 * Stored in the top-level `privateNotes` collection.
 */
export interface PrivateNote {
  id: string;
  /** The ID of the post this note is about. */
  postId: string;
  /** The user who wrote the note (visitor / Circle member). */
  authorId: string;
  /** The user who will receive the note (post author / Host). */
  hostId: string;
  text: string;
  timestamp: number;
}

// ── Feedback & Support ──────────────────────────────────────────────────────

export type FeedbackCategory =
  | 'bug'
  | 'feature_request'
  | 'account'
  | 'circles'
  | 'posts'
  | 'notifications'
  | 'other';

export interface FeedbackSubmission {
  id: string;
  userId: string;
  /** Email address of the submitting user. */
  userEmail: string;
  /** Primary category chosen by the user. */
  category: FeedbackCategory;
  /** Optional subcategory string. */
  subcategory: string | null;
  /** Free-form description written by the user. */
  text: string;
  createdAt: number;
}
