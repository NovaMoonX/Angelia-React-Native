import type { AvatarPreset } from '@/models/types';

const FALLBACK_ADJECTIVES = ['Cosmic', 'Stellar', 'Mystic', 'Aurora', 'Nebula'];
const FALLBACK_NOUNS = ['Traveler', 'Wanderer', 'Dreamer', 'Voyager', 'Spirit'];

const AVATAR_NAME_POOLS: Record<AvatarPreset, { adjectives: string[]; nouns: string[] }> = {
  astronaut: {
    adjectives: ['Orbital', 'Stellar', 'Cosmic', 'Lunar'],
    nouns: ['Pilot', 'Voyager', 'Ranger', 'Explorer'],
  },
  moon: {
    adjectives: ['Lunar', 'Crescent', 'Midnight', 'Silver'],
    nouns: ['Moth', 'Owl', 'Walker', 'Glow'],
  },
  star: {
    adjectives: ['Bright', 'Radiant', 'Golden', 'Shining'],
    nouns: ['Spark', 'Glimmer', 'Beacon', 'Light'],
  },
  galaxy: {
    adjectives: ['Spiral', 'Infinite', 'Vast', 'Deep'],
    nouns: ['Drifter', 'Sage', 'Keeper', 'Mind'],
  },
  nebula: {
    adjectives: ['Misty', 'Violet', 'Ethereal', 'Soft'],
    nouns: ['Cloud', 'Muse', 'Whisper', 'Veil'],
  },
  planet: {
    adjectives: ['Orbital', 'Ringed', 'Distant', 'Blue'],
    nouns: ['Wanderer', 'Scout', 'Child', 'Soul'],
  },
  'cosmic-cat': {
    adjectives: ['Purring', 'Starry', 'Playful', 'Nimble'],
    nouns: ['Pouncer', 'Whisker', 'Paw', 'Nap'],
  },
  'dream-cloud': {
    adjectives: ['Fluffy', 'Sleepy', 'Gentle', 'Drifting'],
    nouns: ['Dreamer', 'Floater', 'Mist', 'Haze'],
  },
  rocket: {
    adjectives: ['Blazing', 'Swift', 'Bold', 'Rising'],
    nouns: ['Blast', 'Trail', 'Launch', 'Surge'],
  },
  constellation: {
    adjectives: ['Mapped', 'Guiding', 'Ancient', 'Fixed'],
    nouns: ['Pattern', 'Guide', 'Chart', 'Line'],
  },
  comet: {
    adjectives: ['Icy', 'Swift', 'Tail', 'Passing'],
    nouns: ['Streak', 'Flash', 'Trail', 'Glint'],
  },
  twilight: {
    adjectives: ['Dusky', 'Rose', 'Fading', 'Hushed'],
    nouns: ['Glow', 'Hour', 'Edge', 'Hush'],
  },
  aurora: {
    adjectives: ['Dancing', 'Northern', 'Vivid', 'Shimmer'],
    nouns: ['Ribbon', 'Wave', 'Curtain', 'Flare'],
  },
  supernova: {
    adjectives: ['Blazing', 'Bursting', 'Radiant', 'Fierce'],
    nouns: ['Flash', 'Burst', 'Blaze', 'Pulse'],
  },
  'lunar-moth': {
    adjectives: ['Gentle', 'Pale', 'Flutter', 'Soft'],
    nouns: ['Wing', 'Moth', 'Glide', 'Drift'],
  },
  satellite: {
    adjectives: ['Orbiting', 'Signal', 'Steady', 'Linked'],
    nouns: ['Ping', 'Relay', 'Beacon', 'Link'],
  },
  alien: {
    adjectives: ['Curious', 'Far', 'Green', 'Odd'],
    nouns: ['Visitor', 'Signal', 'Friend', 'Blink'],
  },
  'black-hole': {
    adjectives: ['Void', 'Eclipse', 'Abyss', 'Silent'],
    nouns: ['Drifter', 'Whisper', 'Shadow', 'Pull'],
  },
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function getPools(avatar: AvatarPreset): { adjectives: string[]; nouns: string[] } {
  return AVATAR_NAME_POOLS[avatar] ?? { adjectives: FALLBACK_ADJECTIVES, nouns: FALLBACK_NOUNS };
}

/** Builds `{Adjective} {Noun} {number}` themed to the user's avatar preset. */
export function generatePublicDisplayName(avatar: AvatarPreset): string {
  const { adjectives, nouns } = getPools(avatar);
  const number = randomInt(10, 9999);
  return `${pickRandom(adjectives)} ${pickRandom(nouns)} ${number}`;
}

const MAX_UNIQUENESS_ATTEMPTS = 24;

/** Generates a display name not present in `taken` (case-insensitive). */
export function generateUniquePublicDisplayName(
  avatar: AvatarPreset,
  taken: Set<string>,
): string {
  const takenLower = new Set(Array.from(taken, (n) => n.toLowerCase()));

  for (let i = 0; i < MAX_UNIQUENESS_ATTEMPTS; i++) {
    const candidate = generatePublicDisplayName(avatar);
    if (!takenLower.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  const base = generatePublicDisplayName(avatar);
  let suffix = randomInt(10000, 99999);
  let candidate = `${base}${suffix}`;
  while (takenLower.has(candidate.toLowerCase())) {
    suffix = randomInt(10000, 99999);
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

export function normalizePublicDisplayNameInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidPublicDisplayName(name: string): boolean {
  const trimmed = normalizePublicDisplayNameInput(name);
  return trimmed.length >= 3 && trimmed.length <= 40;
}
