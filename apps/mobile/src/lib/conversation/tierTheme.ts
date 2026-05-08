import type { PostTier } from '@/models/types';

/** Theme overrides keyed by post tier. */
export interface TierThemeOverrides {
  headerGradientColors: [string, string];
  inputBorderColor: string;
  backgroundPattern: boolean;
  celebratory: boolean;
}

const TIER_THEMES: Record<PostTier, TierThemeOverrides> = {
  everyday: {
    headerGradientColors: ['transparent', 'transparent'],
    inputBorderColor: 'transparent',
    backgroundPattern: false,
    celebratory: false,
  },
  'worth-knowing': {
    headerGradientColors: ['#F59E0B22', '#D9770622'],
    inputBorderColor: '#F59E0B',
    backgroundPattern: false,
    celebratory: false,
  },
  'big-news': {
    headerGradientColors: ['#E11D4822', '#EC489922'],
    inputBorderColor: '#E11D48',
    backgroundPattern: true,
    celebratory: true,
  },
};

export function getTierTheme(tier: PostTier | undefined): TierThemeOverrides {
  return TIER_THEMES[tier ?? 'everyday'];
}
