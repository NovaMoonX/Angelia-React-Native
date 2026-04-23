import type { User, Channel, Post, Comment, ChannelJoinRequest, Message, Connection, PrivateNote } from '@/models/types';

const DEMO_USER: User = {
  id: 'demo-user-1',
  firstName: 'Demo',
  lastName: 'User',
  email: 'demo@angelia.app',
  funFact: 'I love exploring the cosmos!',
  avatar: 'astronaut',
  joinedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  accountProgress: {
    signUpComplete: true,
    emailVerified: true,
    dailyChannelCreated: true,
  },
  customChannelCount: 2,
  status: {
    emoji: '🚀',
    text: 'Building something cool',
    updatedAt: Date.now() - 2 * 60 * 60 * 1000,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  },
};

const DEMO_USER_2: User = {
  id: 'demo-user-2',
  firstName: 'Sarah',
  lastName: 'Moon',
  email: 'sarah@angelia.app',
  funFact: 'I make the best pancakes!',
  avatar: 'moon',
  joinedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
  accountProgress: {
    signUpComplete: true,
    emailVerified: true,
    dailyChannelCreated: true,
  },
  customChannelCount: 1,
  status: {
    emoji: '🍳',
    text: 'Cooking dinner',
    updatedAt: Date.now() - 1 * 60 * 60 * 1000,
    expiresAt: Date.now() + 3 * 60 * 60 * 1000,
  },
};

const DEMO_USER_3: User = {
  id: 'demo-user-3',
  firstName: 'Alex',
  lastName: 'Star',
  email: 'alex@angelia.app',
  funFact: 'I can juggle five balls!',
  avatar: 'star',
  joinedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
  accountProgress: {
    signUpComplete: true,
    emailVerified: true,
    dailyChannelCreated: true,
  },
  customChannelCount: 0,
  status: null,
};

const DEMO_CHANNELS: Channel[] = [
  {
    id: 'demo-user-1-daily',
    name: 'Daily',
    description: 'Your daily updates channel',
    color: 'AMBER',
    isDaily: true,
    ownerId: 'demo-user-1',
    subscribers: ['demo-user-2', 'demo-user-3'],
    inviteCode: null,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    markedForDeletionAt: null,
  },
  {
    id: 'demo-channel-travel',
    name: 'Travel Adventures',
    description: 'Sharing our family travel stories and photos',
    color: 'EMERALD',
    isDaily: false,
    ownerId: 'demo-user-1',
    subscribers: ['demo-user-2'],
    inviteCode: 'TRVL2024',
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    markedForDeletionAt: null,
  },
  {
    id: 'demo-channel-cooking',
    name: 'Family Recipes',
    description: "Grandma's secret recipes and new favorites",
    color: 'PINK',
    isDaily: false,
    ownerId: 'demo-user-2',
    subscribers: ['demo-user-1', 'demo-user-3'],
    inviteCode: 'COOK2024',
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    markedForDeletionAt: null,
  },
  {
    id: 'demo-user-2-daily',
    name: 'Daily',
    description: 'Your daily updates channel',
    color: 'AMBER',
    isDaily: true,
    ownerId: 'demo-user-2',
    subscribers: ['demo-user-1'],
    inviteCode: null,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    markedForDeletionAt: null,
  },
];

const DEMO_POSTS: Post[] = [
  {
    id: 'demo-post-1',
    authorId: 'demo-user-1',
    channelId: 'demo-user-1-daily',
    text: 'Beautiful sunrise this morning! ☀️ Starting the day with gratitude.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1506815444479-bfdb1e96c566?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
    reactions: [
      { emoji: '❤️', userId: 'demo-user-2' },
      { emoji: '😊', userId: 'demo-user-3' },
    ],
    conversationEnrollees: ['demo-user-2'],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
  {
    id: 'demo-post-2',
    authorId: 'demo-user-2',
    channelId: 'demo-channel-cooking',
    text: "Made grandma's famous apple pie today! 🥧 The secret is a pinch of cinnamon in the crust. Recipe in the comments.",
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?w=800&h=600&fit=crop'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    reactions: [
      { emoji: '🔥', userId: 'demo-user-1' },
      { emoji: '😊', userId: 'demo-user-3' },
      { emoji: '❤️', userId: 'demo-user-1' },
    ],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'worth-knowing',
  },
  {
    id: 'demo-post-3',
    authorId: 'demo-user-1',
    channelId: 'demo-channel-travel',
    text: 'Just booked flights to Japan for next spring! 🇯🇵 Cherry blossom season, here we come!',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&h=600&fit=crop'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 24 * 60 * 60 * 1000,
    reactions: [{ emoji: '🎉', userId: 'demo-user-2' }],
    conversationEnrollees: ['demo-user-2'],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'big-news',
  },
  {
    id: 'demo-post-4',
    authorId: 'demo-user-3',
    channelId: 'demo-channel-cooking',
    text: 'Tried making sourdough bread for the first time. It actually turned out great! 🍞',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    reactions: [
      { emoji: '👀', userId: 'demo-user-1' },
      { emoji: '😮', userId: 'demo-user-2' },
    ],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
  {
    id: 'demo-post-5',
    authorId: 'demo-user-2',
    channelId: 'demo-user-2-daily',
    text: 'Taking a moment to appreciate the little things in life. Today, it was a flower blooming in the garden. 🌸 Nature always finds a way to surprise us.',
    media: [
      {
        type: 'video',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        // url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'
        // url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      }
    ],
    timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
    reactions: [
      { emoji: '❤️', userId: 'demo-user-1' },
      { emoji: '😄', userId: 'demo-user-3' },
    ],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'worth-knowing',
  },
  {
    id: 'demo-post-6',
    authorId: 'demo-user-1',
    channelId: 'demo-channel-travel',
    text: 'Planning our next adventure! Here are some of the places we\'re considering. Which one should we visit first? 🗺️✨',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop'
      },
      {
        type: 'video',
        url: 'https://samplelib.com/preview/mp4/sample-5s.mp4',
        // url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=600&fit=crop'
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000,
    reactions: [
      { emoji: '🌍', userId: 'demo-user-2' },
      { emoji: '✈️', userId: 'demo-user-3' },
    ],
    conversationEnrollees: ['demo-user-2'],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
  {
    id: 'demo-post-7',
    authorId: 'demo-user-1',
    channelId: 'demo-user-1-daily',
    text: 'Just finished a great book! 📚 Highly recommend "The Midnight Library" if you\'re looking for something thought-provoking.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 6 * 60 * 60 * 1000,
    reactions: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'big-news',
  },
  {
    // No reactions — shows "Be the first to react! 🎉" since this is another user's post
    id: 'demo-post-8',
    authorId: 'demo-user-2',
    channelId: 'demo-channel-cooking',
    text: 'Anyone else obsessed with matcha lattes lately? ☕️ Found the perfect recipe.',
    media: [],
    timestamp: Date.now() - 8 * 60 * 60 * 1000,
    reactions: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
  {
    // 6 unique emojis with duplicates — exercises count-ordering (❤️×3, 🔥×2, …)
    // and the cap at 5 visible bubbles (🌟 is the 6th and should be hidden)
    id: 'demo-post-9',
    authorId: 'demo-user-3',
    channelId: 'demo-channel-cooking',
    text: 'My sourdough game has officially leveled up! 🍞🏆 Scored a local baking competition this weekend.',
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop'
      }
    ],
    timestamp: Date.now() - 10 * 60 * 60 * 1000,
    reactions: [
      { emoji: '❤️', userId: 'demo-user-1' },
      { emoji: '❤️', userId: 'demo-user-2' },
      { emoji: '❤️', userId: 'demo-user-3' },
      { emoji: '🔥', userId: 'demo-user-1' },
      { emoji: '🔥', userId: 'demo-user-2' },
      { emoji: '😮', userId: 'demo-user-1' },
      { emoji: '👏', userId: 'demo-user-2' },
      { emoji: '🎉', userId: 'demo-user-1' },
      { emoji: '🌟', userId: 'demo-user-2' },
    ],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'big-news',
  },
  // ── Expiry-badge demo posts ────────────────────────────────────────────────
  {
    // Daily circle post exactly at its 14-day retention limit → "⏳ Going away today"
    id: 'demo-post-expiry-today',
    authorId: 'demo-user-2',
    channelId: 'demo-user-2-daily',
    text: 'Whew, what a week! Finally found a moment to breathe. 🌿',
    media: [],
    timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
    reactions: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
  {
    // Daily circle post 12 days old → 2 days left → "⏳ 2d left"
    id: 'demo-post-expiry-2d',
    authorId: 'demo-user-1',
    channelId: 'demo-user-1-daily',
    text: 'Morning run done! Feeling energized for the week ahead. 🏃‍♂️',
    media: [],
    timestamp: Date.now() - 12 * 24 * 60 * 60 * 1000,
    reactions: [
      { emoji: '🔥', userId: 'demo-user-2' },
    ],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
  {
    // Custom circle post 85 days old → 5 days left → "⏳ 5d left"
    id: 'demo-post-expiry-5d',
    authorId: 'demo-user-1',
    channelId: 'demo-channel-travel',
    text: "That trip to the coast was absolutely worth it. Sunsets like that don't get old. 🌅",
    media: [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
      },
    ],
    timestamp: Date.now() - 85 * 24 * 60 * 60 * 1000,
    reactions: [
      { emoji: '😊', userId: 'demo-user-2' },
    ],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
    tier: 'everyday',
  },
];

const DEMO_INVITES: {
  incoming: ChannelJoinRequest[];
  outgoing: ChannelJoinRequest[];
} = {
  incoming: [
    {
      id: 'demo-request-1',
      channelId: 'demo-channel-travel',
      channelOwnerId: 'demo-user-1',
      requesterId: 'demo-user-3',
      message: "Hey! It's Alex. I'd love to see your travel photos!",
      status: 'pending',
      createdAt: Date.now() - 12 * 60 * 60 * 1000,
      respondedAt: null,
    },
  ],
  outgoing: [],
};

/**
 * Pre-seeded comments for demo posts. Stored separately as a subcollection
 * in `posts/{postId}/comments/{commentId}`.
 */
const DEMO_COMMENTS: Record<string, Comment[]> = {
  'demo-post-1': [
    {
      id: 'demo-comment-1',
      authorId: 'demo-user-2',
      text: 'Gorgeous! Wish I could see it!',
      timestamp: Date.now() - 1 * 60 * 60 * 1000,
    },
  ],
  'demo-post-3': [
    {
      id: 'demo-comment-2',
      authorId: 'demo-user-2',
      text: 'So jealous! Take lots of photos!',
      timestamp: Date.now() - 23 * 60 * 60 * 1000,
    },
  ],
  'demo-post-6': [
    {
      id: 'demo-comment-3',
      authorId: 'demo-user-2',
      text: 'The mountain scenery looks amazing!',
      timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
    },
  ],
};

/**
 * Pre-seeded messages for demo conversations. Mirrors the comments on demo
 * posts so the conversation screen shows real content in demo mode.
 */
const DEMO_MESSAGES: Record<string, Message[]> = {
  'demo-post-1': [
    {
      id: 'demo-msg-1-sys-2',
      authorId: 'demo-user-2',
      text: 'joined the conversation with ❤️',
      timestamp: Date.now() - 1 * 60 * 60 * 1000 - 5000,
      parentId: null,
      reactions: {},
      isSystem: true,
    },
    {
      id: 'demo-msg-1',
      authorId: 'demo-user-2',
      text: 'Gorgeous! Wish I could see it!',
      timestamp: Date.now() - 1 * 60 * 60 * 1000,
      parentId: null,
      reactions: {},
    },
  ],
  'demo-post-3': [
    {
      id: 'demo-msg-3-sys-2',
      authorId: 'demo-user-2',
      text: 'joined the conversation with 🎉',
      timestamp: Date.now() - 23 * 60 * 60 * 1000 - 5000,
      parentId: null,
      reactions: {},
      isSystem: true,
    },
    {
      id: 'demo-msg-3',
      authorId: 'demo-user-2',
      text: 'So jealous! Take lots of photos!',
      timestamp: Date.now() - 23 * 60 * 60 * 1000,
      parentId: null,
      reactions: {},
    },
  ],
  'demo-post-6': [
    {
      id: 'demo-msg-6-sys-2',
      authorId: 'demo-user-2',
      text: 'joined the conversation with 🌍',
      timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000 - 5000,
      parentId: null,
      reactions: {},
      isSystem: true,
    },
    {
      id: 'demo-msg-6',
      authorId: 'demo-user-2',
      text: 'The mountain scenery looks amazing!',
      timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
      parentId: null,
      reactions: {},
    },
  ],
};

/**
 * Demo connections for demo-user-1 (the current user in demo mode).
 * demo-user-1 ↔ demo-user-2 are directly connected.
 */
const DEMO_CONNECTIONS: Connection[] = [
  {
    userId: 'demo-user-2',
    connectedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
];

/**
 * Pre-seeded private notes for posts authored by demo-user-1 (the demo current user).
 * Keyed by postId, mirroring DEMO_COMMENTS / DEMO_MESSAGES structure.
 */
const DEMO_PRIVATE_NOTES: Record<string, PrivateNote[]> = {
  'demo-post-1': [
    {
      id: 'demo-note-1',
      postId: 'demo-post-1',
      authorId: 'demo-user-2',
      hostId: 'demo-user-1',
      text: 'What a stunning photo! Where exactly was this taken? 🌅',
      timestamp: Date.now() - 90 * 60 * 1000,
    },
    {
      id: 'demo-note-2',
      postId: 'demo-post-1',
      authorId: 'demo-user-3',
      hostId: 'demo-user-1',
      text: 'This made my whole morning, thank you for sharing ✨',
      timestamp: Date.now() - 45 * 60 * 1000,
    },
  ],
  'demo-post-3': [
    {
      id: 'demo-note-3',
      postId: 'demo-post-3',
      authorId: 'demo-user-2',
      hostId: 'demo-user-1',
      text: 'I am SO jealous — I have always wanted to go during cherry blossom season! 🌸',
      timestamp: Date.now() - 20 * 60 * 60 * 1000,
    },
  ],
};

export const DEMO_DATA = {
  users: {
    currentUser: DEMO_USER,
    users: [DEMO_USER, DEMO_USER_2, DEMO_USER_3],
  },
  channels: DEMO_CHANNELS,
  posts: DEMO_POSTS,
  comments: DEMO_COMMENTS,
  invites: DEMO_INVITES,
  messages: DEMO_MESSAGES,
  connections: DEMO_CONNECTIONS,
  privateNotes: DEMO_PRIVATE_NOTES,
};
