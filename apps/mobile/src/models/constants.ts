import type {
  AvatarPreset,
  ChannelColorOption,
  CirclePostNotificationSettings,
  NotificationSettings,
  PostTier,
} from './types';

export const CUSTOM_CHANNEL_LIMIT = 3;

/**
 * Source-of-truth app version for runtime version-gating checks.
 * Keep this in sync with expo.version in app.config.js.
 */
export const APP_VERSION = '1.0.8';

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
export const AUDIO_TITLE_MAX_LENGTH = 60;
export const AUDIO_CAPTION_MAX_LENGTH = 300;

export const COMMON_EMOJIS = ['❤️', '👀', '😊', '🎉', '😮', '😢', '😄', '🔥'];

/** Default values for the wind-down prompt settings. */
export const DEFAULT_WIND_DOWN_PROMPT: NotificationSettings['windDownPrompt'] = {
  enabled: true,
  hour: 21,
  minute: 0,
};

/** Default values for push notifications about activity on a user's posts. */
export const DEFAULT_POST_ACTIVITY_NOTIFICATION_SETTINGS: NotificationSettings['postActivity'] = {
  reactionsEnabled: true,
  privateNotesEnabled: true,
  conversationMessagesEnabled: true,
  replyMessagesEnabled: true,
};

/** Default values for per-circle post push preferences. */
export const DEFAULT_CIRCLE_POST_NOTIFICATION_SETTINGS = {
  everydayEnabled: false,
  worthKnowingEnabled: false,
  bigNewsEnabled: true,
  withAttachmentsEnabled: false,
};

/** Returns a fresh default per-circle post push preference object. */
export function createDefaultCirclePostNotificationSettings(): CirclePostNotificationSettings {
  return {
    ...DEFAULT_CIRCLE_POST_NOTIFICATION_SETTINGS,
  };
}

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
export const POST_UPLOAD_QUEUE_KEY = '@angelia/post_upload_queue_v1';

/** AsyncStorage key storing the latest per-post activity snapshot the user has reviewed. */
export const POST_ACTIVITY_SEEN_KEY = (userId: string) => `@angelia/post_activity_seen_${userId}`;

/** AsyncStorage key storing when the user last reviewed reactions for a specific post. */
export const POST_REACTIONS_SEEN_KEY = (userId: string, postId: string) => {
  return `@angelia/post_reactions_seen_${userId}_${postId}`;
};

/** AsyncStorage key storing when the user last opened the app on this device. */
export const APP_LAST_OPENED_AT_KEY = (userId: string) => `@angelia/app_last_opened_at_${userId}`;

/** AsyncStorage key that tracks whether the new-user feed guide is still pending or has been dismissed. */
export const ONBOARDING_FEED_GUIDE_STATE_KEY = (userId: string) => `@angelia/onboarding_feed_guide_${userId}`;

/** AsyncStorage key that records whether the feed long-press reaction hint was manually dismissed. */
export const FEED_REACTION_HINT_DISMISSED_KEY = (userId: string) => `@angelia/feed_reaction_hint_dismissed_${userId}`;

/** AsyncStorage key that records whether the user has reacted from feed via long-press at least once. */
export const FEED_REACTION_HINT_USED_KEY = (userId: string) => `@angelia/feed_reaction_hint_used_${userId}`;

/**
 * AsyncStorage key that records when a post host last opened the private notes screen for a post.
 * Used to drive the unread indicator on the host's private-notes badge.
 */
export const PRIVATE_NOTES_SEEN_KEY = (postId: string) => `@angelia/private_notes_seen_${postId}`;

/** Records when the user last opened a specific private note thread. */
export const PRIVATE_NOTE_THREAD_SEEN_KEY = (postId: string, noteId: string) =>
  `@angelia/private_note_thread_seen_${postId}_${noteId}`;

/** External Google Form used for collecting beta feedback quickly from testers. */
export const BETA_FEEDBACK_FORM_URL = 'https://forms.gle/vMoCnBVheTsssTHa8';

/** Android Play Store URL for Angelia app updates. */
export const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.angelia.app&hl=en-US&ah=6uqVrWZq1-EB7pajijs0TRHA5IE';

/** Deep link that opens TestFlight directly on iOS devices. */
export const IOS_TESTFLIGHT_DEEP_LINK = 'itms-beta://';

/** Web fallback for TestFlight in case deep-link opening fails. */
export const IOS_TESTFLIGHT_WEB_URL = 'https://testflight.apple.com/join/2X3vYWBu';

/**
 * AsyncStorage key that records when the current user last opened the conversation screen for a post.
 * Used to drive the unread indicator on the chat tab in the post detail screen.
 */
export const CONVERSATION_LAST_SEEN_KEY = (postId: string) => `@angelia/conversation_last_seen_${postId}`;

/**
 * AsyncStorage key that records whether the user has already seen the "hold to reply" hint in conversations.
 * Once dismissed or used, it is never shown again.
 */
export const CONVERSATION_REPLY_HINT_SEEN_KEY = '@angelia/conversation_reply_hint_seen';

/**
 * AsyncStorage key recording whether the user has already seen the
 * "double-tap to edit" hint in conversations.
 */
export const CONVERSATION_EDIT_HINT_SEEN_KEY = '@angelia/conversation_edit_hint_seen';

/**
 * AsyncStorage key that tracks which custom circles have already been suggested
 * to a user after they react to a connection's Daily Circle post.
 */
export const JOIN_CUSTOM_CIRCLE_SUGGESTIONS_SEEN_KEY = (userId: string) => `@angelia/join_custom_circle_suggestions_seen_${userId}`;

/**
 * AsyncStorage key recording whether a post author has disabled the
 * leave-warning modal when unread private notes/messages still exist.
 */
export const POST_DETAIL_UNREAD_LEAVE_WARNING_DISABLED_KEY = (userId: string) => {
  return `@angelia/post_detail_unread_leave_warning_disabled_${userId}`;
};

/**
 * AsyncStorage key that records which beta update version the user has already dismissed.
 * When BETA_UPDATE_VERSION in BetaUpdateModal is bumped, the modal will show again automatically.
 */
export const BETA_UPDATE_VERSION = '2026-06-08-beta-v1.0.9';

/**
 * Version for the one-time private-circles notice shown on the My Circles tab.
 * Bump when the private circles feature ships or notice copy changes.
 */
export const PRIVATE_CIRCLES_NOTICE_VERSION = '2026-05-private-circles';

/** AsyncStorage key recording whether the user has seen the private-circles notice. */
export const PRIVATE_CIRCLES_NOTICE_SEEN_KEY = (version: string) => {
  return `@angelia/private_circles_notice_seen_${version}`;
};

export const BETA_UPDATE_MODAL_SEEN_KEY = (version: string) => `@angelia/beta_update_modal_seen_${version}`;

/**
 * Version for the one-time notification-settings release notice shown on the
 * Notifications screen. Bump when new notification controls are introduced.
 */
export const NOTIFICATION_SETTINGS_NOTICE_VERSION = '2026-05-16-reactions-and-messages-notifications';

/** Accent color for notification-settings release notice card and bell badge dot. */
export const NOTIFICATION_SETTINGS_NOTICE_ACCENT = '#0EA5E9';

/**
 * AsyncStorage key recording whether the user has seen a specific notification
 * settings release notice version.
 */
export const NOTIFICATION_SETTINGS_NOTICE_SEEN_KEY = (version: string) => {
  return `@angelia/notification_settings_notice_seen_${version}`;
};

/**
 * AsyncStorage key recording whether the user has already seen the release
 * notice bell badge for a specific notification settings notice version.
 */
export const NOTIFICATION_SETTINGS_NOTICE_BADGE_SEEN_KEY = (version: string) => {
  return `@angelia/notification_settings_notice_badge_seen_${version}`;
};

/**
 * AsyncStorage key that records the latest required app version the user has
 * dismissed for a specific platform update prompt.
 */
export const APP_UPDATE_PROMPT_DISMISSED_VERSION_KEY = (platform: 'ios' | 'android') => {
  return `@angelia/app_update_prompt_dismissed_${platform}`;
};

/**
 * AsyncStorage key that records which broadcast message ID the user has dismissed.
 * When the `id` field changes in Firestore, the modal shows again.
 */
export const APP_MESSAGE_DISMISSED_KEY = '@angelia/app_message_dismissed_id';

/**
 * AsyncStorage key that records which feedback form URL the user has dismissed.
 * When the `url` changes in Firestore (new form), the modal shows again.
 */
export const FEEDBACK_FORM_DISMISSED_URL_KEY = '@angelia/feedback_form_dismissed_url';

/** Sentinel timestamp used for statuses that stay active until manually cleared. */
export const STATUS_INDEFINITE_EXPIRES_AT = 8_640_000_000_000;

/**
 * AsyncStorage key used to track whether the current app session already
 * performed the cold-launch scroll-to-top. Cleared on each cold launch;
 * preserved during within-session navigation so scroll position is kept.
 */
export const FEED_SESSION_SCROLLED_KEY = '@angelia/feed_session_scrolled';

/** AsyncStorage key storing the in-progress post compose draft for a user. */
export const POST_CREATE_DRAFT_KEY = (userId: string) => `@angelia/post_create_draft_${userId}`;
