import { compressText, type RetrievalItem } from './retrieval-policy';

export interface CompressContextItemsInput {
  items: RetrievalItem[];
  mustHaveItemIds?: string[];
  maxSectionChars: number;
}

export interface ContextCompressionTraceEntry {
  itemId: string;
  action: 'preserved' | 'compressed';
  originalLength: number;
  compressedLength: number;
  reason: 'must_have' | 'budget';
}

export interface ContextCompressionResult {
  items: RetrievalItem[];
  citations: Array<{ sourceId: string; quote: string }>;
  trace: ContextCompressionTraceEntry[];
}

export function compressContextItems(input: CompressContextItemsInput): ContextCompressionResult {
  const mustHaveItemIds = new Set(input.mustHaveItemIds ?? []);
  const mustHaveItems = input.items.filter((item) => mustHaveItemIds.has(item.id));
  const flexibleItems = input.items.filter((item) => !mustHaveItemIds.has(item.id));
  const outputItems: RetrievalItem[] = [];
  const trace: ContextCompressionTraceEntry[] = [];
  let usedChars = 0;

  for (const item of mustHaveItems) {
    outputItems.push(item);
    usedChars += item.text.length + 1;
    trace.push({
      itemId: item.id,
      action: 'preserved',
      originalLength: item.text.length,
      compressedLength: item.text.length,
      reason: 'must_have'
    });
  }

  for (let index = 0; index < flexibleItems.length; index += 1) {
    const item = flexibleItems[index];
    const remainingItems = flexibleItems.length - index;
    const availableChars = Math.max(0, Math.floor((input.maxSectionChars - usedChars) / Math.max(1, remainingItems)));
    if (availableChars === 0) break;

    const text = compressText(item.text, availableChars);
    if (!text) continue;

    outputItems.push({ ...item, text });
    usedChars += text.length + 1;
    trace.push({
      itemId: item.id,
      action: text.length < item.text.length ? 'compressed' : 'preserved',
      originalLength: item.text.length,
      compressedLength: text.length,
      reason: text.length < item.text.length ? 'budget' : 'must_have'
    });
  }

  return {
    items: outputItems,
    citations: outputItems.map((item) => ({ sourceId: item.id, quote: item.text })),
    trace
  };
}
