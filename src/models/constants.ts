import type { AvatarPreset, ChannelColorOption, PostTier } from './types';

export const CUSTOM_CHANNEL_LIMIT = 3;
export const DAILY_CHANNEL_SUFFIX = '-daily';
export const MAX_FILES = 5;
export const MAX_FILE_SIZE_MB = 10;

export const COMMON_EMOJIS = ['❤️', '👀', '😊', '🎉', '😮', '😢', '😄', '🔥'];

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
