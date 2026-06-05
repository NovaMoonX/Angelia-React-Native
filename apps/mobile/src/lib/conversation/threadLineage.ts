import type { Message } from '@/models/types';

export function resolveMessageLineage(
  parentId: string | null | undefined,
  messagesById: Map<string, Message>,
): { rootId: string | null; grandparentId: string | null } {
  if (!parentId) {
    return { rootId: null, grandparentId: null };
  }

  const parent = messagesById.get(parentId);
  if (!parent) {
    return { rootId: null, grandparentId: null };
  }

  if (parent.parentId == null) {
    return { rootId: parent.id, grandparentId: null };
  }

  const rootId = parent.rootId ?? parent.parentId;
  return { rootId, grandparentId: rootId };
}

export function normalizeMessageThreadFields(message: Message, messagesById: Map<string, Message>): Message {
  if (message.rootId != null || message.grandparentId != null) {
    return message;
  }
  if (message.parentId == null) {
    return message;
  }

  const lineage = resolveMessageLineage(message.parentId, messagesById);
  return {
    ...message,
    rootId: lineage.rootId,
    grandparentId: lineage.grandparentId,
  };
}

export function normalizeMessageList(messages: Message[]): Message[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  return messages.map((message) => normalizeMessageThreadFields(message, byId));
}
