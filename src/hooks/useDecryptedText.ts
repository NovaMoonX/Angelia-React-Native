import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { decryptText } from '@/utils/crypto';

const DECRYPTING_PLACEHOLDER = '🔒 Decrypting…';

/**
 * Decrypts a piece of text that may be AES-256-GCM encrypted.
 *
 * - If `encrypted` is falsy, returns `text` as-is (plaintext, backward-compatible).
 * - If `encrypted` is true and the channel key is cached in Redux, decrypts
 *   asynchronously and returns the plaintext once ready.
 * - While decrypting (or if the key hasn't loaded yet), returns a placeholder.
 *
 * Works for both post body text and comment text — both use the channel key.
 */
export function useDecryptedText(
  channelId: string,
  text: string,
  encrypted?: boolean,
  iv?: string,
): string {
  const channelKey = useAppSelector(
    (state) => state.channels.encryptionKeys[channelId],
  );

  const [decrypted, setDecrypted] = useState<string>(() => {
    if (!encrypted) return text;
    return DECRYPTING_PLACEHOLDER;
  });

  useEffect(() => {
    if (!encrypted || !iv) {
      setDecrypted(text);
      return;
    }

    if (!channelKey) {
      setDecrypted(DECRYPTING_PLACEHOLDER);
      return;
    }

    let cancelled = false;
    decryptText(text, iv, channelKey)
      .then((plaintext) => {
        if (!cancelled) setDecrypted(plaintext);
      })
      .catch(() => {
        // On decryption failure show empty string rather than raw ciphertext
        if (!cancelled) setDecrypted('');
      });

    return () => {
      cancelled = true;
    };
  }, [text, encrypted, iv, channelKey]);

  return decrypted;
}
