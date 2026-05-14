/**
 * Formats an array of strings into a human-readable list.
 *
 * Examples:
 *   []           → ''
 *   ['Alice']    → 'Alice'
 *   ['Alice', 'Bob'] → 'Alice and Bob'
 *   ['Alice', 'Bob', 'Carol'] → 'Alice, Bob, and Carol'
 */
export function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
