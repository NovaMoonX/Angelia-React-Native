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

const FIRST_COMMENT_PHRASES = [
  'Be the first to share your thoughts!',
  'Start the conversation — what do you think?',
  'No comments yet. What\'s on your mind?',
  'Break the ice! Share your reaction.',
  'You could be the first to comment!',
  'Say something! This deserves a comment.',
  'Be the one to get this conversation started.',
  'Empty comments? Time to change that!',
  'Your thoughts? The floor is yours.',
  'First! Drop a comment.',
  'Kick off the discussion — say hi!',
  'No one\'s said anything yet. Your turn!',
  'This needs a comment. Will it be yours?',
  'The conversation starts with you!',
  'Silence is golden, but comments are better.',
  'Say the thing! You know you want to.',
  'Waiting for someone to comment? Be that person.',
  'Add your two cents! (Or more.)',
  'Start something good — leave a comment.',
  'Empty chat? Not for long. Comment away!',
  'Your comment could spark something amazing.',
  'Go ahead, make the first move!',
  'This post is waiting for your comment.',
  'No comments yet? Let\'s fix that.',
  'Be bold. Be first. Comment!',
];

export function getRandomPhrase(phrases: string[] = CONVERSATION_PHRASES): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function getRandomFirstCommentPhrase(): string {
  return FIRST_COMMENT_PHRASES[Math.floor(Math.random() * FIRST_COMMENT_PHRASES.length)];
}
