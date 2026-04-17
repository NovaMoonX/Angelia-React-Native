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

export interface NotificationSettings {
  fcmTokens: string[];
  dailyPromptEnabled: boolean;
  /** Hour of day (0–23) in the user's chosen timezone. Default: 12 (noon). */
  dailyPromptHour: number;
  /** IANA timezone string, e.g. "America/New_York". Default: device timezone. */
  timeZone: string;
}
export type UpdateUserProfileData = Pick<User, 'firstName' | 'lastName' | 'funFact' | 'avatar'>;

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

export interface ChannelColorOption {
  name: string;
  value: string;
  textColor: string;
}
