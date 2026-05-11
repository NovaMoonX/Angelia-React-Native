import type { AvatarPreset, ChannelColorOption, NotificationSettings, PostTier } from './types';

export const CUSTOM_CHANNEL_LIMIT = 3;

/** How long posts are retained before deletion. Must stay in sync with Cloud Functions. */
export const DAILY_POST_RETENTION_DAYS = 14;   // Posts in a Daily Circle expire after 14 days.
export const CUSTOM_POST_RETENTION_DAYS = 90;  // Posts in a Custom Circle expire after 90 days.

/** Show the "going away soon" badge when fewer than this many days remain. */
export const DAILY_POST_EXPIRY_WARNING_DAYS = 3;
export const CUSTOM_POST_EXPIRY_WARNING_DAYS = 7;

export const DAILY_CHANNEL_SUFFIX = '-daily';
export const ANGELIA_WEB_BASE_URL = 'https://angelia.moondreams.dev';
export const MAX_FILES = 5;
export const MAX_FILE_SIZE_MB = 10;
export const MAX_VIDEO_SECONDS = 30;

export const COMMON_EMOJIS = ['❤️', '👀', '😊', '🎉', '😮', '😢', '😄', '🔥'];

/** Default values for the wind-down prompt settings. */
export const DEFAULT_WIND_DOWN_PROMPT: NotificationSettings['windDownPrompt'] = {
  enabled: true,
  hour: 21,
  minute: 0,
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  'astronaut', 'moon', 'star', 'galaxy', 'nebula', 'planet',
  'cosmic-cat', 'dream-cloud', 'rocket', 'constellation', 'comet', 'twilight',
  'aurora', 'supernova', 'lunar-moth', 'satellite', 'alien', 'black-hole',
];

export const CHANNEL_COLORS: ChannelColorOption[] = [
  { name: 'INDIGO', value: '#6366F1', textColor: '#FFFFFF' },
  { name: 'AMBER', value: '#F59E0B', textColor: '#000000' },
  { name: 'EMERALD', value: '#10B981', textColor: '#FFFFFF' },
  { name: 'PINK', value: '#EC4899', textColor: '#FFFFFF' },
  { name: 'LIME', value: '#84CC16', textColor: '#000000' },
  { name: 'PURPLE', value: '#8B5CF6', textColor: '#FFFFFF' },
  { name: 'ROSE', value: '#F43F5E', textColor: '#FFFFFF' },
  { name: 'CYAN', value: '#06B6D4', textColor: '#000000' },
  { name: 'ORANGE', value: '#F97316', textColor: '#000000' },
  { name: 'TEAL', value: '#14B8A6', textColor: '#FFFFFF' },
  { name: 'BLUE', value: '#3B82F6', textColor: '#FFFFFF' },
  { name: 'VIOLET', value: '#7C3AED', textColor: '#FFFFFF' },
];

export const POST_TIERS: Array<{ value: PostTier; label: string; emoji: string; badgeBg: string; badgeText: string }> = [
  { value: 'everyday',     label: 'Everyday Update', emoji: '📅', badgeBg: 'transparent', badgeText: 'transparent' },
  { value: 'worth-knowing', label: 'Worth Knowing',  emoji: '⭐', badgeBg: '#D97706',     badgeText: '#FFFFFF' },
  { value: 'big-news',     label: 'Big News',        emoji: '🔔', badgeBg: '#E11D48',     badgeText: '#FFFFFF' },
];

export const ALL_POST_TIERS: PostTier[] = POST_TIERS.map((t) => t.value);

/** AsyncStorage key that persists the newest post timestamp the user has acknowledged on the feed. */
export const FEED_LAST_SEEN_TIMESTAMP_KEY = '@angelia/feed_last_seen_timestamp';

/** AsyncStorage key that tracks whether the new-user feed guide is still pending or has been dismissed. */
export const ONBOARDING_FEED_GUIDE_STATE_KEY = (userId: string) => `@angelia/onboarding_feed_guide_${userId}`;

/**
 * AsyncStorage key that records when a post host last opened the private notes screen for a post.
 * Used to drive the unread indicator on the host's private-notes badge.
 */
export const PRIVATE_NOTES_SEEN_KEY = (postId: string) => `@angelia/private_notes_seen_${postId}`;

/** External Google Form used for collecting beta feedback quickly from testers. */
export const BETA_FEEDBACK_FORM_URL = 'https://forms.gle/vMoCnBVheTsssTHa8';

/**
 * AsyncStorage key that records when the current user last opened the conversation screen for a post.
 * Used to drive the unread indicator on the chat tab in the post detail screen.
 */
export const CONVERSATION_LAST_SEEN_KEY = (postId: string) => `@angelia/conversation_last_seen_${postId}`;

/**
 * AsyncStorage key that tracks which custom circles have already been suggested
 * to a user after they react to a connection's Daily Circle post.
 */
export const JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY = (userId: string) => `@angelia/join_custom_circle_suggestions_seen_${userId}`;

/**
 * AsyncStorage key that records which beta update version the user has already dismissed.
 * When BETA_UPDATE_VERSION in BetaUpdateModal is bumped, the modal will show again automatically.
 */
export const BETA_UPDATE_MODAL_SEEN_KEY = (version: string) => `@angelia/beta_update_modal_seen_${version}`;
