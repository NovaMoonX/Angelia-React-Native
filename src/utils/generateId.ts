import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';

export function generateId(type: 'nano' | 'uuid' = 'nano'): string {
  return type === 'uuid' ? uuidv4() : nanoid();
}
