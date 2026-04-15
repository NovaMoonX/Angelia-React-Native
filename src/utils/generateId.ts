import * as Crypto from 'expo-crypto';

export function generateId(type: 'nano' | 'uuid' = 'nano'): string {
  return type === 'uuid' 
    ? Crypto.randomUUID() 
    : Crypto.randomUUID().replace(/-/g, '').slice(0, 21); // nanoid-like
}