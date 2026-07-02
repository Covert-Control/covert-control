// src/utils/bookmarkAnchor.ts
//
// DOM helpers for anchoring bookmarks to a position in a rendered chapter.
//
// A chapter is rendered by a read-only Tiptap/ProseMirror editor. The stable
// anchor is the index of the top-level block (paragraph/heading) the selection
// starts in, plus a short quote used to re-find/verify the spot if an author
// edit shifts the index. Line numbers are NOT used — they reflow with the
// reader's font-size/width settings; block index does not.

import { toQuote } from '../types/bookmark';

export interface Anchor {
  paragraphIndex: number;
  quote: string;
}

export function normalize(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Top-level block elements of the rendered chapter. ProseMirror mounts its
 * content into a `.ProseMirror` element inside the EditorContent wrapper; its
 * direct element children are the blocks we index.
 */
export function getBlockElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const pm = root.querySelector('.ProseMirror') as HTMLElement | null;
  const container = pm ?? root;
  return Array.from(container.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  );
}

/** Block index for an arbitrary node within the content (or -1). */
function blockIndexForNode(blocks: HTMLElement[], node: Node | null): number {
  if (!node) return -1;
  const el: HTMLElement | null =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  if (!el) return -1;
  return blocks.findIndex((b) => b === el || b.contains(el));
}

/**
 * Build an anchor from the current text selection, if it is a non-empty
 * selection inside `root`. Anchored to the block where the selection starts.
 */
export function getSelectionAnchor(root: HTMLElement | null): Anchor | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const blocks = getBlockElements(root);
  const index = blockIndexForNode(blocks, range.startContainer);
  if (index < 0) return null;

  const quote = toQuote(sel.toString());
  if (!quote) return null;

  return { paragraphIndex: index, quote };
}

/**
 * Build an anchor from the first block currently visible below the viewport
 * top — used as a fallback for "save my place" when nothing is selected.
 * `topOffset` accounts for any sticky header overlapping the content.
 */
export function getTopVisibleAnchor(
  root: HTMLElement | null,
  topOffset = 96
): Anchor | null {
  const blocks = getBlockElements(root);
  if (blocks.length === 0) return null;

  for (let i = 0; i < blocks.length; i++) {
    const rect = blocks[i].getBoundingClientRect();
    if (rect.bottom > topOffset) {
      return { paragraphIndex: i, quote: toQuote(blocks[i].textContent ?? '') };
    }
  }

  const last = blocks.length - 1;
  return { paragraphIndex: last, quote: toQuote(blocks[last].textContent ?? '') };
}

/**
 * Resolve an anchor to a block element. Prefers the stored index, but falls
 * back to searching by quote text if the index is missing or its text no
 * longer matches (e.g. the author inserted paragraphs above it).
 */
export function findBlock(
  root: HTMLElement | null,
  paragraphIndex: number,
  quote?: string
): HTMLElement | null {
  const blocks = getBlockElements(root);
  if (blocks.length === 0) return null;

  const needle = normalize(quote ?? '').slice(0, 40);
  const byIndex = blocks[paragraphIndex] ?? null;

  if (byIndex) {
    if (!needle) return byIndex;
    if (normalize(byIndex.textContent ?? '').includes(needle)) return byIndex;
  }

  if (needle) {
    const found = blocks.find((b) =>
      normalize(b.textContent ?? '').includes(needle)
    );
    if (found) return found;
  }

  return byIndex;
}

/** Top of a block relative to a positioned container, in px. */
export function blockTopWithin(
  container: HTMLElement | null,
  block: HTMLElement | null
): number | null {
  if (!container || !block) return null;
  const cRect = container.getBoundingClientRect();
  const bRect = block.getBoundingClientRect();
  return bRect.top - cRect.top;
}

/** Scroll an anchored block into view and briefly flash-highlight it. */
export function scrollToAnchor(
  root: HTMLElement | null,
  paragraphIndex: number,
  quote?: string
): boolean {
  const el = findBlock(root, paragraphIndex, quote);
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashBlock(el);
  return true;
}

/** Apply a transient highlight class to a block. */
export function flashBlock(el: HTMLElement): void {
  el.classList.remove('bm-flash');
  // Force reflow so re-adding the class restarts the animation.
  void el.offsetWidth;
  el.classList.add('bm-flash');
  window.setTimeout(() => el.classList.remove('bm-flash'), 1900);
}
