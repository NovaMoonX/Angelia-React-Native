const PREVIEW_MAX_LENGTH = 120;

export function buildTextPreview(text: string, emptyFallback: string | null = null): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return emptyFallback;
  }
  if (normalized.length <= PREVIEW_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, PREVIEW_MAX_LENGTH - 3)}...`;
}

export function getPostPreviewText(post: { text: string; media: unknown[] | null } | null | undefined): string | null {
  if (post == null) {
    return null;
  }
  const textPreview = buildTextPreview(post.text, null);
  if (textPreview) {
    return textPreview;
  }
  if (post.media != null && post.media.length > 0) {
    return 'Includes a photo or video';
  }
  return null;
}
