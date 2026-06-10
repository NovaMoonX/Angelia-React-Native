import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/** Mirrors DAILY_CHANNEL_SUFFIX in src/models/constants.ts — keep in sync. */
const DAILY_CHANNEL_SUFFIX = '-daily';

// ── Types (mirrors src/models/types.ts in the app) ─────────────────────────
// IMPORTANT: Keep these types in sync with src/models/types.ts in the app.

type AppNotificationType =
	| 'join_channel_request'
	| 'join_channel_accepted'
	| 'custom_circle_invite'
	| 'connection_request'
	| 'connection_accepted'
	| 'post_reaction'
	| 'conversation_message'
	| 'new_post'
	| 'comment_reply'
	| 'private_note'
	| 'private_note_reply';

type PostTier = 'everyday' | 'worth-knowing' | 'big-news';

type NotificationTarget =
	| { type: 'user'; userId: string }
	| { type: 'channel_tier'; channelId: string; tier: PostTier }
	| { type: 'thread'; threadId: string };

interface BaseAppNotification {
	id: string;
	type: AppNotificationType;
	actorId: string;
	target: NotificationTarget;
	createdAt: number;
}

interface JoinChannelRequestNotification extends BaseAppNotification {
	type: 'join_channel_request';
	requesterId: string;
	requesterFirstName: string;
	requesterLastName: string;
	channelId: string;
	channelName: string;
	joinRequestId: string;
}

interface JoinChannelAcceptedNotification extends BaseAppNotification {
	type: 'join_channel_accepted';
	channelId: string;
	channelName: string;
	joinRequestId: string;
}

interface CustomCircleInviteNotification extends BaseAppNotification {
	type: 'custom_circle_invite';
	requestId: string;
	inviterId: string;
	inviterFirstName: string;
	inviterLastName: string;
	channelId: string;
	channelName: string;
	inviteCode: string;
}

interface ConnectionRequestNotification extends BaseAppNotification {
	type: 'connection_request';
	fromId: string;
	fromFirstName: string;
	fromLastName: string;
	connectionRequestId: string;
}

interface ConnectionAcceptedNotification extends BaseAppNotification {
	type: 'connection_accepted';
	toFirstName: string;
	toLastName: string;
	connectionRequestId: string;
}

/** Mirrors NewPostNotification in src/models/types.ts — keep in sync. */
interface NewPostNotification extends BaseAppNotification {
	type: 'new_post';
	postId: string;
	channelId: string;
	channelName: string;
	isDaily: boolean;
	tier: PostTier;
	hasAttachments: boolean;
	authorFirstName: string;
	authorLastName: string;
	postTextPreview: string | null;
}

type UnifiedPostNotificationInput = NewPostNotification;

/** Mirrors PostReactionNotification in src/models/types.ts — keep in sync. */
interface PostReactionNotification extends BaseAppNotification {
	type: 'post_reaction';
	postId: string;
	reactorFirstName: string;
	reactorLastName: string;
	emoji: string;
}

/** Mirrors ConversationMessageNotification in src/models/types.ts — keep in sync. */
interface ConversationMessageNotification extends BaseAppNotification {
	type: 'conversation_message';
	postId: string;
	senderFirstName: string;
	senderLastName: string;
	messagePreview: string;
}

/** Mirrors CommentReplyNotification in src/models/types.ts — keep in sync. */
interface CommentReplyNotification extends BaseAppNotification {
	type: 'comment_reply';
	postId: string;
	parentMessageId: string;
	senderFirstName: string;
	senderLastName: string;
	messagePreview: string;
}

/** Mirrors PrivateNoteNotification in src/models/types.ts — keep in sync. */
interface PrivateNoteNotification extends BaseAppNotification {
	type: 'private_note';
	postId: string;
	authorFirstName: string;
	authorLastName: string;
}

/** Mirrors PrivateNoteReplyNotification in src/models/types.ts — keep in sync. */
interface PrivateNoteReplyNotification extends BaseAppNotification {
	type: 'private_note_reply';
	postId: string;
	noteId: string;
	senderFirstName: string;
	senderLastName: string;
	messagePreview: string;
}

type AppNotification =
	| JoinChannelRequestNotification
	| JoinChannelAcceptedNotification
	| CustomCircleInviteNotification
	| ConnectionRequestNotification
	| ConnectionAcceptedNotification
	| NewPostNotification
	| PostReactionNotification
	| ConversationMessageNotification
	| CommentReplyNotification
	| PrivateNoteNotification
	| PrivateNoteReplyNotification;

type UserInboxSurface = 'post_activity' | 'notifications';

interface BaseUserInboxItem {
	id: string;
	surface: UserInboxSurface;
	actorId: string;
	createdAt: number;
	readAt: number | null;
}

type UserInboxItem = BaseUserInboxItem & (
	| { type: 'join_channel_request'; requesterId: string; requesterFirstName: string; requesterLastName: string; channelId: string; channelName: string; joinRequestId: string }
	| { type: 'join_channel_accepted'; channelId: string; channelName: string; joinRequestId: string }
	| { type: 'custom_circle_invite'; requestId: string; inviterId: string; inviterFirstName: string; inviterLastName: string; channelId: string; channelName: string; inviteCode: string }
	| { type: 'connection_request'; fromId: string; fromFirstName: string; fromLastName: string; connectionRequestId: string }
	| { type: 'connection_accepted'; toFirstName: string; toLastName: string; connectionRequestId: string }
	| { type: 'post_reaction'; postId: string; reactorFirstName: string; reactorLastName: string; emoji: string }
	| { type: 'conversation_message'; postId: string; senderFirstName: string; senderLastName: string; messagePreview: string }
	| { type: 'comment_reply'; postId: string; parentMessageId: string; senderFirstName: string; senderLastName: string; messagePreview: string }
	| { type: 'new_post'; postId: string; channelId: string; channelName: string; isDaily: boolean; tier: PostTier; hasAttachments: boolean; authorFirstName: string; authorLastName: string; postTextPreview: string | null }
	| { type: 'private_note'; postId: string; authorFirstName: string; authorLastName: string }
	| { type: 'private_note_reply'; postId: string; noteId: string; senderFirstName: string; senderLastName: string; messagePreview: string }
);

interface ConnectionRequest {
	id: string;
	fromId: string;
	toId: string;
	status: 'pending' | 'accepted' | 'declined';
	createdAt: number;
	respondedAt: number | null;
	note: string | null;
}

/** Mirrors ChannelJoinRequest in src/models/types.ts — keep in sync. */
interface ChannelJoinRequest {
	id: string;
	channelId: string;
	channelOwnerId: string;
	requesterId: string;
	message: string;
	status: 'pending' | 'accepted' | 'declined';
	createdAt: number;
	respondedAt: number | null;
}

interface CircleInviteRequest {
	id: string;
	channelId: string;
	channelOwnerId: string;
	inviterId: string;
	inviteeId: string;
	status: 'pending' | 'accepted' | 'declined';
	createdAt: number;
	respondedAt: number | null;
}

interface FcmTokenEntry {
	deviceId: string;
	token: string;
	deviceName?: string;
}

/** Mirrors the public profile fields stored at usersPublic/{uid}. */
interface UserPublic {
	id: string;
	firstName: string;
	lastName: string;
}

interface UserNotificationSettings {
	fcmTokens?: FcmTokenEntry[];
	postActivity?: {
		reactionsEnabled?: boolean;
		privateNotesEnabled?: boolean;
		conversationMessagesEnabled?: boolean;
		replyMessagesEnabled?: boolean;
	};
	postByCircle?: Record<string, CirclePostNotificationSettings>;
}

interface CirclePostNotificationSettings {
	everydayEnabled?: boolean;
	worthKnowingEnabled?: boolean;
	bigNewsEnabled?: boolean;
	withAttachmentsEnabled?: boolean;
}

/** Mirrors Channel in src/models/types.ts — keep in sync. */
interface Channel {
	id: string;
	ownerId: string;
	subscribers: string[];
	isDaily: boolean | null;
	name: string;
	description: string;
	inviteCode: string | null;
	markedForDeletionAt: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildFcmPayload(notification: AppNotification): {
	title: string;
	body: string;
	data: Record<string, string>;
} {
	if (notification.type === 'join_channel_request') {
		const n = notification as JoinChannelRequestNotification;
		return {
			title: 'New Join Request',
			body: `${n.requesterFirstName} ${n.requesterLastName} wants to join ${n.channelName}`,
			data: {
				type: n.type,
				channelId: n.channelId,
				channelName: n.channelName,
				joinRequestId: n.joinRequestId,
				requesterId: n.requesterId,
				requesterFirstName: n.requesterFirstName,
				requesterLastName: n.requesterLastName,
			},
		};
	}

	if (notification.type === 'join_channel_accepted') {
		const n = notification as JoinChannelAcceptedNotification;
		return {
			title: 'Request Accepted! 🎉',
			body: `You've been accepted into ${n.channelName}`,
			data: {
				type: n.type,
				channelId: n.channelId,
				channelName: n.channelName,
				joinRequestId: n.joinRequestId,
			},
		};
	}

	if (notification.type === 'custom_circle_invite') {
		const n = notification as CustomCircleInviteNotification;
		return {
			title: '✨ Circle Invite',
			body: `${n.inviterFirstName} ${n.inviterLastName} invited you to join ${n.channelName}`,
			data: {
				type: n.type,
				requestId: n.requestId,
				inviterId: n.inviterId,
				inviterFirstName: n.inviterFirstName,
				inviterLastName: n.inviterLastName,
				channelId: n.channelId,
				channelName: n.channelName,
				inviteCode: n.inviteCode,
			},
		};
	}

	if (notification.type === 'connection_request') {
		const n = notification as ConnectionRequestNotification;
		return {
			title: '🤝 Connection Request',
			body: `${n.fromFirstName} ${n.fromLastName} wants to connect with you`,
			data: {
				type: n.type,
				fromId: n.fromId,
				fromFirstName: n.fromFirstName,
				fromLastName: n.fromLastName,
				connectionRequestId: n.connectionRequestId,
			},
		};
	}

	if (notification.type === 'new_post') {
		const n = notification as NewPostNotification;
		return buildUnifiedPostPayload(n);
	}

	if (notification.type === 'post_reaction') {
		const n = notification as PostReactionNotification;
		return {
			title: 'New Reaction on Your Post',
			body: `${n.reactorFirstName} reacted with ${n.emoji}`,
			data: {
				type: n.type,
				postId: n.postId,
				reactorFirstName: n.reactorFirstName,
				reactorLastName: n.reactorLastName,
				emoji: n.emoji,
			},
		};
	}

	if (notification.type === 'conversation_message') {
		const n = notification as ConversationMessageNotification;
		return {
			title: 'New Message on Your Post',
			body: `${n.senderFirstName}: ${n.messagePreview}`,
			data: {
				type: n.type,
				postId: n.postId,
				senderFirstName: n.senderFirstName,
				senderLastName: n.senderLastName,
				messagePreview: n.messagePreview,
			},
		};
	}

	if (notification.type === 'comment_reply') {
		const n = notification as CommentReplyNotification;
		return {
			title: 'New Reply to Your Message',
			body: `${n.senderFirstName}: ${n.messagePreview}`,
			data: {
				type: n.type,
				postId: n.postId,
				parentMessageId: n.parentMessageId,
				senderFirstName: n.senderFirstName,
				senderLastName: n.senderLastName,
				messagePreview: n.messagePreview,
			},
		};
	}

	if (notification.type === 'private_note') {
		const n = notification as PrivateNoteNotification;
		return {
			title: '🔒 Private Note',
			body: `${n.authorFirstName} ${n.authorLastName} sent you a private note`,
			data: {
				type: n.type,
				postId: n.postId,
				authorFirstName: n.authorFirstName,
				authorLastName: n.authorLastName,
			},
		};
	}

	if (notification.type === 'private_note_reply') {
		const n = notification as PrivateNoteReplyNotification;
		return {
			title: '💬 Private Note Reply',
			body: `${n.senderFirstName}: ${n.messagePreview}`,
			data: {
				type: n.type,
				postId: n.postId,
				noteId: n.noteId,
				senderFirstName: n.senderFirstName,
				senderLastName: n.senderLastName,
				messagePreview: n.messagePreview,
			},
		};
	}

	// connection_accepted
	const n = notification as ConnectionAcceptedNotification;
	return {
		title: `🎉 You're connected!`,
		body: `${n.toFirstName} ${n.toLastName} accepted your connection request`,
		data: {
			type: n.type,
			toFirstName: n.toFirstName,
			toLastName: n.toLastName,
			connectionRequestId: n.connectionRequestId,
		},
	};
}

function buildUnifiedPostPayload(n: UnifiedPostNotificationInput): {
	title: string;
	body: string;
	data: Record<string, string>;
} {
	const fullName = `${n.authorFirstName} ${n.authorLastName}`.trim();
	const ownerName = fullName || n.authorFirstName || 'Someone';
	const attachmentText = n.hasAttachments ? ' with attachments' : '';
	const circleLabel = n.isDaily ? 'Daily Circle' : `"${n.channelName}"`;
	const title =
		n.tier === 'big-news'
			? `🚨 Big News from ${ownerName}`
			: n.tier === 'worth-knowing'
				? `💡 Worth Knowing from ${ownerName}`
				: `${ownerName} shared a new post`;

	return {
		title,
		body: `New post${attachmentText} in ${circleLabel}`,
		data: {
			type: 'new_post',
			postId: n.postId,
			channelId: n.channelId,
			channelName: n.channelName,
			isDaily: String(n.isDaily),
			tier: n.tier,
			hasAttachments: String(n.hasAttachments),
			authorFirstName: n.authorFirstName,
			authorLastName: n.authorLastName,
			postTextPreview: n.postTextPreview ?? '',
		},
	};
}

/**
 * Sends an FCM multicast to all provided tokens with the given payload.
 * Failure is best-effort — individual token failures are swallowed.
 */
async function sendFcmToTokens(
	tokens: string[],
	payload: { title: string; body: string; data: Record<string, string> },
	tokenOwnersByToken?: Map<string, Set<string>>,
): Promise<void> {
	if (tokens.length === 0) return;
	const { title, body, data } = payload;
	try {
		const res = await messaging.sendEachForMulticast({
			tokens,
			notification: { title, body },
			data,
			apns: {
				payload: {
					aps: {
						sound: 'default',
						badge: 1,
					},
				},
			},
			android: {
				priority: 'high',
				notification: {
					sound: 'default',
				},
			},
		});
		if (res.failureCount > 0) {
			const invalidTokens: string[] = [];
			res.responses.forEach((r, idx) => {
				if (!r.success) {
					const errCode = r.error?.code ?? '';
					if (errCode === 'messaging/registration-token-not-registered') {
						invalidTokens.push(tokens[idx]);
					}
					console.error(`Failed to send FCM to token ${tokens[idx]}:`, r.error);
				}
			});

			if (invalidTokens.length > 0 && tokenOwnersByToken) {
				const ownerIds = new Set<string>();
				invalidTokens.forEach((token) => {
					const owners = tokenOwnersByToken.get(token);
					if (!owners) {
						return;
					}
					owners.forEach((ownerId) => {
						ownerIds.add(ownerId);
					});
				});

				await Promise.all(
					Array.from(ownerIds).map(async (ownerId) => {
						try {
							const settingsRef = db.collection('userNotificationSettings').doc(ownerId);
							await db.runTransaction(async (transaction) => {
								const settingsSnap = await transaction.get(settingsRef);
								if (!settingsSnap.exists) {
									return;
								}

								const settings = settingsSnap.data() as UserNotificationSettings;
								const nextTokens = (settings.fcmTokens ?? []).filter((entry) => {
									return !invalidTokens.includes(entry.token);
								});

								transaction.update(settingsRef, { fcmTokens: nextTokens });
							});
						} catch (pruneErr) {
							console.error(`Failed pruning invalid FCM tokens for ${ownerId}:`, pruneErr);
						}
					}),
				);
			}
		} else {
			console.log(`Successfully sent FCM to ${tokens.length} tokens`);
		}
	} catch (err) {
		console.error('FCM send error:', err);
	}
}

const REACTION_NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

const DEFAULT_POST_ACTIVITY_SETTINGS = {
	reactionsEnabled: true,
	privateNotesEnabled: true,
	conversationMessagesEnabled: true,
	replyMessagesEnabled: true,
};

const DEFAULT_CIRCLE_POST_SETTINGS = {
	everydayEnabled: false,
	worthKnowingEnabled: false,
	bigNewsEnabled: true,
	withAttachmentsEnabled: false,
};

async function getNotificationSettingsForUser(userId: string): Promise<UserNotificationSettings | null> {
	const snap = await db.collection('userNotificationSettings').doc(userId).get();
	if (!snap.exists) return null;
	return snap.data() as UserNotificationSettings;
}

function getTokensFromSettings(settings: UserNotificationSettings | null): string[] {
	if (!settings) return [];
	return (settings.fcmTokens ?? [])
		.map((t) => {
			return t.token;
		})
		.filter(Boolean);
}

function isPostActivityNotificationType(type: AppNotificationType): boolean {
	return type === 'post_reaction' || type === 'private_note' || type === 'private_note_reply' || type === 'conversation_message' || type === 'comment_reply';
}

function isPostActivityNotificationEnabled(
	notification: AppNotification,
	settings: UserNotificationSettings | null,
): boolean {
	if (!isPostActivityNotificationType(notification.type)) {
		return true;
	}

	const postActivity = {
		...DEFAULT_POST_ACTIVITY_SETTINGS,
		...(settings?.postActivity ?? {}),
	};

	if (notification.type === 'post_reaction') {
		return postActivity.reactionsEnabled;
	}

	if (notification.type === 'private_note' || notification.type === 'private_note_reply') {
		return postActivity.privateNotesEnabled;
	}

	if (notification.type === 'conversation_message') {
		return postActivity.conversationMessagesEnabled;
	}

	if (notification.type === 'comment_reply') {
		return postActivity.replyMessagesEnabled;
	}

	return true;
}

function isCirclePostNotification(notification: AppNotification): notification is NewPostNotification {
	return notification.type === 'new_post';
}

function isCirclePostNotificationEnabled(
	notification: AppNotification,
	settings: UserNotificationSettings | null,
): boolean {
	if (!isCirclePostNotification(notification)) {
		return true;
	}

	const target = notification.target;
	if (target.type !== 'channel_tier') {
		return false;
	}

	const channelId = target.channelId;
	const channelPrefs = {
		...DEFAULT_CIRCLE_POST_SETTINGS,
		...((settings?.postByCircle ?? {})[channelId] ?? {}),
	};

	const tierEnabled =
		target.tier === 'big-news'
			? channelPrefs.bigNewsEnabled
			: target.tier === 'worth-knowing'
				? channelPrefs.worthKnowingEnabled
				: channelPrefs.everydayEnabled;

	const hasAttachments = notification.type === 'new_post' ? notification.hasAttachments === true : false;

	return tierEnabled || (hasAttachments && channelPrefs.withAttachmentsEnabled);
}

function getReactionCooldownDocId(targetUserId: string, actorId: string, postId: string): string {
	return `post_reaction__${targetUserId}__${actorId}__${postId}`;
}

async function reserveReactionCooldownSlot(
	notification: PostReactionNotification,
	targetUserId: string,
): Promise<boolean> {
	const cooldownDocId = getReactionCooldownDocId(targetUserId, notification.actorId, notification.postId);
	const cooldownRef = db.collection('notificationCooldowns').doc(cooldownDocId);
	const now = Date.now();
	let shouldSend = false;

	await db.runTransaction(async (transaction) => {
		const cooldownSnap = await transaction.get(cooldownRef);
		const rawData = cooldownSnap.exists ? (cooldownSnap.data() as Record<string, unknown>) : null;
		const lastSentAt = typeof rawData?.lastSentAt === 'number' ? rawData.lastSentAt : 0;
		if (now - lastSentAt < REACTION_NOTIFICATION_COOLDOWN_MS) {
			return;
		}

		const createdAt = typeof rawData?.createdAt === 'number' ? rawData.createdAt : now;
		shouldSend = true;
		transaction.set(cooldownRef, {
			type: notification.type,
			targetUserId,
			actorId: notification.actorId,
			postId: notification.postId,
			lastSentAt: now,
			createdAt,
			updatedAt: now,
		});
	});

	return shouldSend;
}

function getDefaultInboxSurface(notification: AppNotification): UserInboxSurface {
	if (
		notification.type === 'post_reaction'
		|| notification.type === 'private_note'
		|| notification.type === 'conversation_message'
	) {
		return 'post_activity';
	}
	return 'notifications';
}

async function resolvePrivateNoteReplySurface(
	notification: PrivateNoteReplyNotification,
	targetUserId: string,
): Promise<UserInboxSurface> {
	const postSnap = await db.collection('posts').doc(notification.postId).get();
	if (!postSnap.exists) {
		return 'notifications';
	}
	const post = postSnap.data() as { authorId?: string };
	if (post.authorId === targetUserId) {
		return 'post_activity';
	}
	return 'notifications';
}

function getInboxItemId(notification: AppNotification): string {
	if (notification.type === 'post_reaction') {
		return `${notification.postId}_post_reaction`;
	}
	return notification.id;
}

async function buildUserInboxItem(
	notification: AppNotification,
	targetUserId: string,
): Promise<UserInboxItem> {
	const createdAt = Date.now();
	let surface = getDefaultInboxSurface(notification);
	if (notification.type === 'private_note_reply') {
		surface = await resolvePrivateNoteReplySurface(notification, targetUserId);
	}

	const base: BaseUserInboxItem = {
		id: getInboxItemId(notification),
		surface,
		actorId: notification.actorId,
		createdAt,
		readAt: null,
	};

	switch (notification.type) {
	case 'join_channel_request':
		return {
			...base,
			type: 'join_channel_request',
			surface: 'notifications',
			requesterId: notification.requesterId,
			requesterFirstName: notification.requesterFirstName,
			requesterLastName: notification.requesterLastName,
			channelId: notification.channelId,
			channelName: notification.channelName,
			joinRequestId: notification.joinRequestId,
		};
	case 'join_channel_accepted':
		return {
			...base,
			type: 'join_channel_accepted',
			surface: 'notifications',
			channelId: notification.channelId,
			channelName: notification.channelName,
			joinRequestId: notification.joinRequestId,
		};
	case 'custom_circle_invite':
		return {
			...base,
			type: 'custom_circle_invite',
			surface: 'notifications',
			requestId: notification.requestId,
			inviterId: notification.inviterId,
			inviterFirstName: notification.inviterFirstName,
			inviterLastName: notification.inviterLastName,
			channelId: notification.channelId,
			channelName: notification.channelName,
			inviteCode: notification.inviteCode,
		};
	case 'connection_request':
		return {
			...base,
			type: 'connection_request',
			surface: 'notifications',
			fromId: notification.fromId,
			fromFirstName: notification.fromFirstName,
			fromLastName: notification.fromLastName,
			connectionRequestId: notification.connectionRequestId,
		};
	case 'connection_accepted':
		return {
			...base,
			type: 'connection_accepted',
			surface: 'notifications',
			toFirstName: notification.toFirstName,
			toLastName: notification.toLastName,
			connectionRequestId: notification.connectionRequestId,
		};
	case 'post_reaction':
		return {
			...base,
			type: 'post_reaction',
			surface: 'post_activity',
			postId: notification.postId,
			reactorFirstName: notification.reactorFirstName,
			reactorLastName: notification.reactorLastName,
			emoji: notification.emoji,
		};
	case 'conversation_message':
		return {
			...base,
			type: 'conversation_message',
			surface: 'post_activity',
			postId: notification.postId,
			senderFirstName: notification.senderFirstName,
			senderLastName: notification.senderLastName,
			messagePreview: notification.messagePreview,
		};
	case 'comment_reply':
		return {
			...base,
			type: 'comment_reply',
			surface: 'notifications',
			postId: notification.postId,
			parentMessageId: notification.parentMessageId,
			senderFirstName: notification.senderFirstName,
			senderLastName: notification.senderLastName,
			messagePreview: notification.messagePreview,
		};
	case 'new_post':
		return {
			...base,
			type: 'new_post',
			surface: 'notifications',
			postId: notification.postId,
			channelId: notification.channelId,
			channelName: notification.channelName,
			isDaily: notification.isDaily,
			tier: notification.tier,
			hasAttachments: notification.hasAttachments,
			authorFirstName: notification.authorFirstName,
			authorLastName: notification.authorLastName,
			postTextPreview: notification.postTextPreview ?? null,
		};
	case 'private_note':
		return {
			...base,
			type: 'private_note',
			surface: 'post_activity',
			postId: notification.postId,
			authorFirstName: notification.authorFirstName,
			authorLastName: notification.authorLastName,
		};
	case 'private_note_reply':
		return {
			...base,
			type: 'private_note_reply',
			surface,
			postId: notification.postId,
			noteId: notification.noteId,
			senderFirstName: notification.senderFirstName,
			senderLastName: notification.senderLastName,
			messagePreview: notification.messagePreview,
		};
	default: {
		const _exhaustive: never = notification;
		throw new Error(`Unsupported notification type for inbox: ${(_exhaustive as AppNotification).type}`);
	}
	}
}

async function writeUserInboxItem(
	notification: AppNotification,
	targetUserId: string,
): Promise<void> {
	const item = await buildUserInboxItem(notification, targetUserId);
	// Full document write so readAt: null is stored reliably (merge would drop null fields).
	await db
		.collection('userInbox')
		.doc(targetUserId)
		.collection('items')
		.doc(item.id)
		.set(item);
}

/**
 * Triggered when a new document is created in the `notifications` collection.
 * Fetches the target user's (or channel's subscribers') FCM tokens, sends the
 * push notification to all registered devices, then deletes the notification document.
 *
 * Supported targets:
 *   - `user`         — a single specific user (existing behavior)
 *   - `channel_tier` — all subscribers of a channel, e.g. for big-news posts
 */
export const sendAppNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
	const snap = event.data;
	if (!snap) return;

	const notification = snap.data() as AppNotification;
	const payload = buildFcmPayload(notification);

	if (notification.target.type === 'user') {
		// ── Single-user target ─────────────────────────────────────────────
		const targetUserId = notification.target.userId;
		await writeUserInboxItem(notification, targetUserId).catch(() => {});
		const targetSettings = await getNotificationSettingsForUser(targetUserId);

		if (!isPostActivityNotificationEnabled(notification, targetSettings)) {
			await snap.ref.delete();
			return;
		}

		const tokens = getTokensFromSettings(targetSettings);
		if (tokens.length === 0) {
			await snap.ref.delete();
			return;
		}

		const tokenOwnersByToken = new Map<string, Set<string>>();
		tokens.forEach((token) => {
			tokenOwnersByToken.set(token, new Set([targetUserId]));
		});

		if (notification.type === 'post_reaction') {
			const shouldSend = await reserveReactionCooldownSlot(notification, targetUserId);
			if (!shouldSend) {
				await snap.ref.delete();
				return;
			}
		}
		await sendFcmToTokens(tokens, payload, tokenOwnersByToken);
	} else if (notification.target.type === 'channel_tier') {
		// ── Channel-tier target: fan-out to all channel subscribers ────────
		const channelSnap = await db.collection('channels').doc(notification.target.channelId).get();

		if (!channelSnap.exists) {
			await snap.ref.delete();
			return;
		}

		const channel = channelSnap.data() as Channel;
		// Notify all subscribers; exclude the post author (actorId) to avoid
		// sending a push to the person who just posted.
		const recipientIds = channel.subscribers.filter((id) => id !== notification.actorId);

		// Fan-out: fetch settings for all recipients in parallel, then apply
		// per-circle preferences before collecting tokens.
		const recipientSettings = await Promise.all(
			recipientIds.map(async (recipientId) => {
				const settings = await getNotificationSettingsForUser(recipientId);
				return { recipientId, settings };
			}),
		);

		const enabledRecipients = recipientSettings.filter(({ settings }) => {
				return isCirclePostNotificationEnabled(notification, settings);
			});

		await Promise.all(
			recipientIds.map(async (recipientId) => {
				await writeUserInboxItem(notification, recipientId).catch(() => {});
			}),
		);

		const allTokens = enabledRecipients.flatMap(({ settings }) => {
				return getTokensFromSettings(settings);
			});

		const tokenOwnersByToken = new Map<string, Set<string>>();
		enabledRecipients.forEach(({ recipientId, settings }) => {
			const recipientTokens = getTokensFromSettings(settings);
			recipientTokens.forEach((token) => {
				const owners = tokenOwnersByToken.get(token) ?? new Set<string>();
				owners.add(recipientId);
				tokenOwnersByToken.set(token, owners);
			});
		});

		await sendFcmToTokens(allTokens, payload, tokenOwnersByToken);
	} else {
		// `thread` targets and any future unrecognized target types are not yet
		// supported.  Fall through to deletion so the document is cleaned up.
	}

	// Always delete the notification document after processing
	await snap.ref.delete();
});

// ── Cloud Function: Create mutual connection on request acceptance ──────────

/**
 * Triggered when a `connectionRequests` document is updated.
 * When the status changes to 'accepted':
 *   1. Writes mutual connection documents for both parties.
 *   2. Adds each user to the other's daily circle as a subscriber, so the
 *      standard channel subscription automatically includes each other's feed.
 *   3. Sends a `connection_accepted` push notification to the original requester.
 *
 * All writes are batched for atomicity. The idempotency guard on
 * `before.status` prevents duplicate work if the function is retried.
 */
export const onConnectionRequestAccepted = onDocumentUpdated('connectionRequests/{requestId}', async (event) => {
	const before = event.data?.before.data() as ConnectionRequest | undefined;
	const after = event.data?.after.data() as ConnectionRequest | undefined;

	if (!before || !after) return;

	// Only act when status transitions from non-accepted to accepted.
	// Checking `before.status === 'accepted'` makes this idempotent: if the
	// Cloud Function is retried (e.g. after a transient failure), the second
	// execution will see `before.status === 'accepted'` and exit early,
	// preventing duplicate writes to the connections subcollection.
	if (before.status === 'accepted' || after.status !== 'accepted') return;

	const { fromId, toId } = after;
	const requestId = event.params.requestId;
	const connectedAt = Date.now();

	// Fetch the acceptor's public profile for the notification payload.
	const toUserSnap = await db.collection('usersPublic').doc(toId).get();
	const toUser = toUserSnap.exists ? (toUserSnap.data() as UserPublic) : null;

	// 1. Commit the mutual connection documents and notification atomically.
	//    These are the core of the operation and must succeed together.
	const connectionBatch = db.batch();

	connectionBatch.set(db.collection('connections').doc(fromId).collection('people').doc(toId), {
		userId: toId,
		connectedAt,
	});
	connectionBatch.set(db.collection('connections').doc(toId).collection('people').doc(fromId), {
		userId: fromId,
		connectedAt,
	});

	if (toUser) {
		const notifRef = db.collection('notifications').doc();
		connectionBatch.set(notifRef, {
			id: notifRef.id,
			type: 'connection_accepted',
			actorId: toId,
			target: { type: 'user', userId: fromId },
			toFirstName: toUser.firstName,
			toLastName: toUser.lastName,
			connectionRequestId: requestId,
			createdAt: connectedAt,
		});
	}

	await connectionBatch.commit();

	// 2. Add each user as a subscriber in the other's daily circle so that the
	//    regular channel subscription delivers each other's feed automatically.
	//    This runs separately so a missing daily channel document (edge case)
	//    does not roll back the connection and notification committed above.
	try {
		const circlesBatch = db.batch();
		circlesBatch.update(db.collection('channels').doc(`${toId}${DAILY_CHANNEL_SUFFIX}`), {
			subscribers: FieldValue.arrayUnion(fromId),
		});
		circlesBatch.update(db.collection('channels').doc(`${fromId}${DAILY_CHANNEL_SUFFIX}`), {
			subscribers: FieldValue.arrayUnion(toId),
		});
		await circlesBatch.commit();
	} catch (err) {
		console.error(
			`onConnectionRequestAccepted: failed to update daily circle subscribers for ${fromId} ↔ ${toId}:`,
			err,
		);
	}
});

// ── Cloud Function: Create mutual connection when a circle join is accepted ─

/**
 * Triggered when a `channelJoinRequests` document is updated.
 * When the status changes to 'accepted':
 *   1. Writes mutual connection documents for the requester and the circle owner.
 *   2. Adds each user as a subscriber in the other's daily circle so their feeds
 *      are visible without a separate connection request.
 *
 * The write is idempotent: if `before.status` is already 'accepted', the
 * function exits early so retries do not produce duplicate documents.
 */
export const onJoinRequestAccepted = onDocumentUpdated('channelJoinRequests/{requestId}', async (event) => {
	const before = event.data?.before.data() as ChannelJoinRequest | undefined;
	const after = event.data?.after.data() as ChannelJoinRequest | undefined;

	if (!before || !after) return;

	// Only act when status transitions to 'accepted' for the first time.
	if (before.status === 'accepted' || after.status !== 'accepted') return;

	const { requesterId, channelOwnerId } = after;
	const connectedAt = Date.now();

	// 1. Commit the mutual connection documents atomically.
	const connectionBatch = db.batch();

	connectionBatch.set(db.collection('connections').doc(requesterId).collection('people').doc(channelOwnerId), {
		userId: channelOwnerId,
		connectedAt,
	});
	connectionBatch.set(db.collection('connections').doc(channelOwnerId).collection('people').doc(requesterId), {
		userId: requesterId,
		connectedAt,
	});

	await connectionBatch.commit();

	// 2. Add each user as a subscriber in the other's daily circle.
	//    Runs separately so a missing daily channel document (edge case)
	//    does not roll back the connection committed above.
	try {
		const circlesBatch = db.batch();
		circlesBatch.update(db.collection('channels').doc(`${channelOwnerId}${DAILY_CHANNEL_SUFFIX}`), {
			subscribers: FieldValue.arrayUnion(requesterId),
		});
		circlesBatch.update(db.collection('channels').doc(`${requesterId}${DAILY_CHANNEL_SUFFIX}`), {
			subscribers: FieldValue.arrayUnion(channelOwnerId),
		});
		await circlesBatch.commit();
	} catch (err) {
		console.error(
			`onJoinRequestAccepted: failed to update daily circle subscribers for ${requesterId} ↔ ${channelOwnerId}:`,
			err,
		);
	}
});

// ── Cloud Function: Add invited user to circle on invite acceptance ────────

/**
 * Triggered when a `circleInviteRequests` document is updated.
 * When the status changes to 'accepted':
 *   1. Adds the invitee to the channel's subscribers list.
 *
 * The function is idempotent: if `before.status` is already 'accepted', the
 * function exits early so retries do not produce duplicate subscriber writes.
 */
export const onCircleInviteRequestAccepted = onDocumentUpdated('circleInviteRequests/{requestId}', async (event) => {
	const before = event.data?.before.data() as CircleInviteRequest | undefined;
	const after = event.data?.after.data() as CircleInviteRequest | undefined;

	if (!before || !after) return;
	if (before.status === 'accepted' || after.status !== 'accepted') return;

	const batch = db.batch();
	batch.update(db.collection('channels').doc(after.channelId), { subscribers: FieldValue.arrayUnion(after.inviteeId) });
	await batch.commit();
});

/**
 * Triggered when a `circleInviteRequests` document is created.
 * Writes a `custom_circle_invite` notification for the invitee.
 */
export const onCircleInviteRequestCreated = onDocumentCreated('circleInviteRequests/{requestId}', async (event) => {
	const snap = event.data;
	if (!snap) return;

	const request = snap.data() as CircleInviteRequest;
	const channelSnap = await db.collection('channels').doc(request.channelId).get();
	if (!channelSnap.exists) {
		await snap.ref.delete();
		return;
	}

	const channel = channelSnap.data() as Channel;
	const inviterSnap = await db.collection('usersPublic').doc(request.inviterId).get();
	const inviter = inviterSnap.exists ? (inviterSnap.data() as UserPublic) : null;

	const notifRef = db.collection('notifications').doc();
	await notifRef.set({
		id: notifRef.id,
		type: 'custom_circle_invite',
		actorId: request.inviterId,
		target: { type: 'user', userId: request.inviteeId },
		requestId: request.id,
		inviterId: request.inviterId,
		inviterFirstName: inviter?.firstName ?? 'Someone',
		inviterLastName: inviter?.lastName ?? '',
		channelId: channel.id,
		channelName: channel.name,
		inviteCode: channel.inviteCode ?? '',
		createdAt: request.createdAt,
	});
});

// ── Cloud Function: Disconnect two users ──────────────────────────────────

/**
 * Written by the client to `disconnectRequests/{requestId}` to kick off a
 * server-side disconnect.  Firestore rules ensure only the requester can create
 * the document.
 */
interface DisconnectRequest {
	requesterId: string;
	targetUserId: string;
	createdAt: number;
}

/**
 * Triggered when a `disconnectRequests` document is created.
 *
 * In a single Firestore batch it:
 *   1. Deletes the mutual connection documents for both parties.
 *   2. Removes the target user from every channel owned by the requester
 *      where the target is currently a subscriber (including their daily circle).
 *   3. Removes the requester from the target's daily circle.
 *
 * Using a single batch keeps costs low (one Admin SDK round-trip) and makes
 * the operation atomic from the Cloud Function's perspective.
 */
export const onDisconnectRequest = onDocumentCreated('disconnectRequests/{requestId}', async (event) => {
	const snap = event.data;
	if (!snap) return;

	const { requesterId, targetUserId } = snap.data() as DisconnectRequest;
	if (!requesterId || !targetUserId) {
		await snap.ref.delete();
		return;
	}

	const batch = db.batch();

	// 1. Remove both sides of the connection.
	batch.delete(db.collection('connections').doc(requesterId).collection('people').doc(targetUserId));
	batch.delete(db.collection('connections').doc(targetUserId).collection('people').doc(requesterId));

	// 2. Remove the target from every channel owned by the requester where
	//    they are listed as a subscriber (covers the requester's daily circle
	//    and any custom circles they own).
	const channelsSnap = await db
		.collection('channels')
		.where('ownerId', '==', requesterId)
		.where('subscribers', 'array-contains', targetUserId)
		.get();

	for (const channelDoc of channelsSnap.docs) {
		batch.update(channelDoc.ref, {
			subscribers: FieldValue.arrayRemove(targetUserId),
		});
	}

	// 3. Remove the requester from the target's daily circle.
	batch.update(db.collection('channels').doc(`${targetUserId}${DAILY_CHANNEL_SUFFIX}`), {
		subscribers: FieldValue.arrayRemove(requesterId),
	});

	// 4. Clean up the request document.
	batch.delete(snap.ref);

	await batch.commit();
});

// ── Helper: Delete a post with all its media ──────────────────────────────

/**
 * Deletes a post document and all its associated media from Firebase Storage.
 * Recursively deletes the post to also clean up subcollections (messages,
 * comments, privateNotes). Media deletion is best-effort — a storage error
 * will not prevent the Firestore deletion.
 *
 * @param postRef The Firestore DocumentReference for the post
 * @param bucket The Firebase Storage bucket instance
 * @returns true if deletion succeeded, false otherwise
 */
async function deleteUserInboxItemsForPost(postId: string): Promise<void> {
	const snap = await db.collectionGroup('items').where('postId', '==', postId).get();
	if (snap.empty) {
		return;
	}

	const batch = db.batch();
	for (const itemDoc of snap.docs) {
		batch.delete(itemDoc.ref);
	}
	await batch.commit();
}

async function deleteUserInboxItemsForChannel(channelId: string): Promise<void> {
	const snap = await db.collectionGroup('items').where('channelId', '==', channelId).get();
	if (snap.empty) {
		return;
	}

	const batch = db.batch();
	for (const itemDoc of snap.docs) {
		batch.delete(itemDoc.ref);
	}
	await batch.commit();
}

/**
 * Triggered when a post document is updated. When the author marks a post for
 * deletion, remove all userInbox items tied to that post immediately rather than
 * waiting for the nightly hard-delete job.
 */
export const onPostMarkedForDeletion = onDocumentUpdated('posts/{postId}', async (event) => {
	const before = event.data?.before.data() as { markedForDeletionAt?: number | null } | undefined;
	const after = event.data?.after.data() as { markedForDeletionAt?: number | null } | undefined;

	if (!before || !after) return;

	const wasMarked = before.markedForDeletionAt != null;
	const isMarked = after.markedForDeletionAt != null;
	if (wasMarked || !isMarked) return;

	const postId = event.params.postId;
	try {
		await deleteUserInboxItemsForPost(postId);
		console.log(`onPostMarkedForDeletion: removed inbox items for post ${postId}`);
	} catch (err) {
		console.error(`onPostMarkedForDeletion: failed to remove inbox items for post ${postId}:`, err);
	}
});

async function deletePostWithMedia(postRef: admin.firestore.DocumentReference, bucket: any): Promise<boolean> {
	const postId = postRef.id;
	try {
		await deleteUserInboxItemsForPost(postId);

		// Delete Firebase Storage media files (best-effort).
		try {
			await bucket.deleteFiles({ prefix: `posts/${postId}/` });
		} catch (err) {
			console.error(`deletePostWithMedia: failed to delete Storage files for post ${postId}:`, err);
			// Continue with Firestore deletion even if Storage fails
		}

		// Recursively delete the post document and all subcollections.
		await db.recursiveDelete(postRef);
		return true;
	} catch (err) {
		console.error(`deletePostWithMedia: failed to delete post ${postId}:`, err);
		return false;
	}
}

// ── Cloud Function: Cascade-delete circles marked for deletion ─────────────

/**
 * Runs once every 24 hours (UTC midnight) and permanently removes any circle
 * (custom channel) that has been marked for deletion by its owner.
 *
 * Deletion order (to satisfy the constraint that a circle is only removed once
 * all related data is gone):
 *   1. Delete Firebase Storage media files for every post in the channel.
 *   2. Recursively delete every post document (which also removes the
 *      `messages`, `comments`, and `privateNotes` subcollections).
 *   3. Delete all `channelJoinRequests` documents for the channel.
 *   4. Delete the channel document itself.
 *
 * Each channel is processed independently so a failure on one does not block
 * the others.
 */
const DELETE_BATCH_SIZE = 500;

export const deleteMarkedChannels = onSchedule('every 24 hours', async () => {
	const channelsSnap = await db.collection('channels').where('markedForDeletionAt', '!=', null).get();

	if (channelsSnap.empty) return;

	for (const channelDoc of channelsSnap.docs) {
		const channelId = channelDoc.id;
		console.log(`deleteMarkedChannels: starting cleanup for channel ${channelId}`);

		try {
			// ── Step 1 & 2: Collect all posts and delete them with their media ────────
			const postsSnap = await db.collection('posts').where('channelId', '==', channelId).get();

			const bucket = admin.storage().bucket();
			let deletedPostCount = 0;
			for (const postDoc of postsSnap.docs) {
				const success = await deletePostWithMedia(postDoc.ref, bucket);
				if (success) deletedPostCount++;
			}

			// ── Step 3: Delete channelJoinRequests for this channel ───────────────────
			const joinRequestsSnap = await db.collection('channelJoinRequests').where('channelId', '==', channelId).get();

			const joinRequestRefs = joinRequestsSnap.docs.map((d) => d.ref);
			for (let i = 0; i < joinRequestRefs.length; i += DELETE_BATCH_SIZE) {
				const batch = db.batch();
				for (const ref of joinRequestRefs.slice(i, i + DELETE_BATCH_SIZE)) {
					batch.delete(ref);
				}
				await batch.commit();
			}

			// ── Step 3b: Delete circleInviteRequests for this channel ────────────────
			const inviteRequestsSnap = await db.collection('circleInviteRequests').where('channelId', '==', channelId).get();

			const inviteRequestRefs = inviteRequestsSnap.docs.map((d) => d.ref);
			for (let i = 0; i < inviteRequestRefs.length; i += DELETE_BATCH_SIZE) {
				const batch = db.batch();
				for (const ref of inviteRequestRefs.slice(i, i + DELETE_BATCH_SIZE)) {
					batch.delete(ref);
				}
				await batch.commit();
			}

			// ── Step 4: Remove inbox items tied to this channel ─────────────────────
			await deleteUserInboxItemsForChannel(channelId);

			// ── Step 5: Delete the channel document itself ────────────────────────────
			await channelDoc.ref.delete();

			console.log(
				`deleteMarkedChannels: successfully deleted channel ${channelId} ` +
					`(${deletedPostCount}/${postsSnap.size} posts, ${joinRequestsSnap.size} join requests, ${inviteRequestsSnap.size} circle invites)`,
			);
		} catch (err) {
			console.error(`deleteMarkedChannels: unexpected error processing channel ${channelId}:`, err);
		}
	}
});

// ── Cloud Function: Delete posts marked for deletion ────────────────────────

/**
 * Runs once every 24 hours and permanently removes any post that has been
 * marked for deletion by its author (markedForDeletionAt is not null).
 *
 * Deletion order:
 *   1. Delete Firebase Storage media files for the post.
 *   2. Recursively delete the post document (which also removes the
 *      `messages`, `comments`, and `privateNotes` subcollections).
 *
 * Each post is processed independently so a failure on one does not block
 * the others.
 */
export const deleteMarkedPosts = onSchedule('every 24 hours', async () => {
	const postsSnap = await db.collection('posts').where('markedForDeletionAt', '!=', null).get();

	if (postsSnap.empty) return;

	const bucket = admin.storage().bucket();
	let deleteCount = 0;

	for (const postDoc of postsSnap.docs) {
		const success = await deletePostWithMedia(postDoc.ref, bucket);
		if (success) {
			deleteCount++;
			console.log(`deleteMarkedPosts: successfully deleted marked post ${postDoc.id}`);
		}
	}

	if (deleteCount > 0) {
		console.log(`deleteMarkedPosts: cleaned up ${deleteCount} marked post(s)`);
	}
});

// ── Cloud Function: Delete expired posts every 24 hours ────────────────────

/**
 * Daily retention policy:
 *   - Posts in a Daily Circle expire after 14 days.
 *   - Posts in a Custom Circle expire after 3 months (90 days).
 *
 * Runs once every 24 hours. Queries all posts older than 14 days (the shorter
 * cutoff), then deletes them if the post's channel is a Daily Circle, or if
 * the post is older than 90 days for a Custom Circle.
 */
const DAILY_POST_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const CUSTOM_POST_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days (~3 months)

export const deleteExpiredPosts = onSchedule('every 24 hours', async () => {
	const now = Date.now();
	const dailyCutoff = now - DAILY_POST_RETENTION_MS;
	const customCutoff = now - CUSTOM_POST_RETENTION_MS;

	// Build a channelId → isDaily map from all channel documents.
	const channelsSnap = await db.collection('channels').select('isDaily').get();
	const channelIsDaily = new Map<string, boolean>();
	for (const doc of channelsSnap.docs) {
		channelIsDaily.set(doc.id, doc.data().isDaily === true);
	}

	// Fetch all posts older than the shortest retention window (14 days).
	// Posts between 14 and 90 days old will be filtered further below.
	const oldPostsSnap = await db.collection('posts').where('timestamp', '<', dailyCutoff).get();

	const toDelete: admin.firestore.DocumentReference[] = [];
	for (const doc of oldPostsSnap.docs) {
		const data = doc.data() as { channelId?: string; timestamp?: number };
		const { channelId, timestamp } = data;
		if (typeof channelId !== 'string' || typeof timestamp !== 'number') continue;
		const isDaily = channelIsDaily.get(channelId) ?? false;
		if (isDaily || timestamp < customCutoff) {
			toDelete.push(doc.ref);
		}
	}

	// Delete all expired posts with their media.
	const bucket = admin.storage().bucket();
	let deleteCount = 0;
	for (const postRef of toDelete) {
		const success = await deletePostWithMedia(postRef, bucket);
		if (success) deleteCount++;
	}

	if (deleteCount > 0) {
		console.log(`deleteExpiredPosts: cleaned up ${deleteCount} expired post(s)`);
	}
});
