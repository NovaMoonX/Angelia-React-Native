const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;

export function isValidEmoji(str: string): boolean {
  return EMOJI_REGEX.test(str);
}

const CONVERSATION_PHRASES = [
  'What made you share this?',
  'Tell us more!',
  'This is so cool!',
  'Love this update!',
  'Thanks for sharing!',
  'How did this happen?',
  'What a great moment!',
  'This made my day!',
];

export function getRandomPhrase(phrases: string[] = CONVERSATION_PHRASES): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}
