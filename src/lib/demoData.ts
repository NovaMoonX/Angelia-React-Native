import type { User, Channel, Post, ChannelJoinRequest } from '@/models/types';

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
    comments: [
      {
        id: 'demo-comment-1',
        authorId: 'demo-user-2',
        text: 'Gorgeous! Wish I could see it!',
        timestamp: Date.now() - 1 * 60 * 60 * 1000,
      },
    ],
    conversationEnrollees: ['demo-user-1', 'demo-user-2'],
    markedForDeletionAt: null,
    status: 'ready',
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
    comments: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
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
    comments: [
      {
        id: 'demo-comment-2',
        authorId: 'demo-user-2',
        text: 'So jealous! Take lots of photos!',
        timestamp: Date.now() - 23 * 60 * 60 * 1000,
      },
    ],
    conversationEnrollees: ['demo-user-1', 'demo-user-2'],
    markedForDeletionAt: null,
    status: 'ready',
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
    comments: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
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
    comments: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
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
    comments: [
      {
        id: 'demo-comment-3',
        authorId: 'demo-user-2',
        text: 'The mountain scenery looks amazing!',
        timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
      },
    ],
    conversationEnrollees: ['demo-user-1', 'demo-user-2'],
    markedForDeletionAt: null,
    status: 'ready',
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
    comments: [],
    conversationEnrollees: [],
    markedForDeletionAt: null,
    status: 'ready',
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

export const DEMO_DATA = {
  users: {
    currentUser: DEMO_USER,
    users: [DEMO_USER, DEMO_USER_2, DEMO_USER_3],
  },
  channels: DEMO_CHANNELS,
  posts: DEMO_POSTS,
  invites: DEMO_INVITES,
};
