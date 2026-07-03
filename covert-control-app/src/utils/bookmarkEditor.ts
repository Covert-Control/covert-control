// src/utils/bookmarkEditor.ts
//
// Editor-based (ProseMirror) anchoring for bookmarks. Unlike the DOM helpers in
// bookmarkAnchor.ts (kept for legacy paragraphIndex bookmarks), these use the
// Tiptap editor's document positions, which pinpoint the EXACT selected spot and
// disambiguate repeated text — the 47th "The" has a different position than the
// 1st. `from`/`to` are the primary anchor; the stored `quote` verifies the spot
// still matches on restore and re-finds it if an author edit shifted positions.

import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { toQuote } from '../types/bookmark';
import { flashBlock, normalize } from './bookmarkAnchor';

export interface EditorAnchor {
  from: number;
  to: number;
  quote: string;
}

/**
 * Capture the current selection as { from, to, quote } from the read-only
 * editor. ProseMirror tracks the DOM selection even when editable:false, so
 * editor.state.selection is the source; posAtDOM is a fallback if state lags.
 */
export function getEditorSelection(editor: Editor | null): EditorAnchor | null {
  if (!editor) return null;

  let { from, to } = editor.state.selection;

  if (from >= to) {
    // Fallback: derive positions straight from the live DOM selection.
    const dom = window.getSelection();
    if (dom && dom.rangeCount > 0 && !dom.isCollapsed && dom.anchorNode && dom.focusNode) {
      try {
        const a = editor.view.posAtDOM(dom.anchorNode, dom.anchorOffset);
        const b = editor.view.posAtDOM(dom.focusNode, dom.focusOffset);
        from = Math.min(a, b);
        to = Math.max(a, b);
      } catch {
        return null;
      }
    }
  }

  if (from == null || to == null || from >= to) return null;

  const quote = toQuote(editor.state.doc.textBetween(from, to, ' ', ' '));
  if (!quote) return null;

  return { from, to, quote };
}

/**
 * Capture { from, to, quote } directly from a DOM Range via posAtDOM. Unlike
 * getEditorSelection this does not depend on ProseMirror having synced its
 * selection state yet — more reliable on mobile, where selection-drag handles
 * don't emit the events we'd otherwise wait on.
 */
export function getEditorAnchorForRange(
  editor: Editor | null,
  range: Range
): EditorAnchor | null {
  if (!editor) return null;
  try {
    const a = editor.view.posAtDOM(range.startContainer, range.startOffset);
    const b = editor.view.posAtDOM(range.endContainer, range.endOffset);
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    if (from >= to) return null;
    const quote = toQuote(editor.state.doc.textBetween(from, to, ' ', ' '));
    if (!quote) return null;
    return { from, to, quote };
  } catch {
    return null;
  }
}

interface StoredAnchor {
  from?: number;
  to?: number;
  quote: string;
}

/**
 * Resolve a stored anchor to valid positions in the CURRENT chapter doc:
 *   1. If from/to are in range and the text there still matches `quote`, use them.
 *   2. Otherwise (author edited, or legacy anchor) re-find `quote` in the doc.
 *   3. Last resort: trust the raw positions if they're at least in range.
 */
export function resolveAnchor(
  editor: Editor,
  anchor: StoredAnchor
): { from: number; to: number } | null {
  const doc = editor.state.doc;
  const size = doc.content.size;
  const q = normalize(anchor.quote);

  if (
    anchor.from != null &&
    anchor.to != null &&
    anchor.from >= 0 &&
    anchor.to <= size &&
    anchor.from < anchor.to
  ) {
    const text = normalize(doc.textBetween(anchor.from, anchor.to, ' ', ' '));
    // quote is truncated to ~100 chars, so a longer selection starts with it.
    if (q && (text === q || text.startsWith(q))) {
      return { from: anchor.from, to: anchor.to };
    }
  }

  if (q) {
    const found = findQuoteInDoc(doc, q);
    if (found) return found;
  }

  if (anchor.from != null && anchor.from >= 0 && anchor.from <= size) {
    const to = Math.min(Math.max(anchor.to ?? anchor.from, anchor.from), size);
    return { from: anchor.from, to };
  }

  return null;
}

/** Build the chapter's normalized text plus a map from each char to its doc position. */
function buildDocTextIndex(doc: PMNode): { text: string; posAt: number[] } {
  let text = '';
  const posAt: number[] = [];
  let prevSpace = true; // seed true so leading whitespace is trimmed (matches normalize)

  doc.descendants((node, pos) => {
    if (node.isText) {
      const raw = node.text ?? '';
      for (let j = 0; j < raw.length; j++) {
        const isSpace = /\s/.test(raw[j]);
        if (isSpace) {
          if (prevSpace) continue; // collapse whitespace runs
          text += ' ';
          posAt.push(pos + j);
          prevSpace = true;
        } else {
          text += raw[j];
          posAt.push(pos + j);
          prevSpace = false;
        }
      }
      return false; // text nodes have no element children to descend into
    }
    // Treat block boundaries as a single separating space.
    if (node.isBlock && !prevSpace) {
      text += ' ';
      posAt.push(pos);
      prevSpace = true;
    }
    return true;
  });

  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    posAt.pop();
  }
  return { text, posAt };
}

/** Find `normalizedQuote` in the doc and return its exact positions, or null. */
function findQuoteInDoc(
  doc: PMNode,
  normalizedQuote: string
): { from: number; to: number } | null {
  const { text, posAt } = buildDocTextIndex(doc);
  const idx = text.indexOf(normalizedQuote);
  if (idx < 0) return null;

  const from = posAt[idx];
  const lastChar = posAt[idx + normalizedQuote.length - 1];
  if (from == null || lastChar == null) return null;

  return { from, to: lastChar + 1 };
}

/** Scroll a resolved range into view and briefly highlight the exact characters. */
export function revealEditorRange(
  editor: Editor,
  from: number,
  to: number
): boolean {
  try {
    const view = editor.view;
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);

    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    const startEl =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as HTMLElement);
    startEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    flashRange(range);
    return true;
  } catch (e) {
    console.warn('revealEditorRange failed', e);
    return false;
  }
}

/**
 * Highlight the exact character range. Uses the CSS Custom Highlight API (paints
 * an overlay without mutating the read-only ProseMirror DOM); falls back to
 * flashing the nearest block on browsers that lack it.
 */
export function flashRange(range: Range): void {
  const w = window as any;
  if (w.CSS?.highlights && typeof w.Highlight === 'function') {
    try {
      const hl = new w.Highlight(range.cloneRange());
      w.CSS.highlights.set('bm-flash', hl);
      window.setTimeout(() => {
        try {
          w.CSS.highlights.delete('bm-flash');
        } catch {
          /* noop */
        }
      }, 1900);
      return;
    } catch {
      /* fall through to block flash */
    }
  }

  const node = range.startContainer;
  const el =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : (node as HTMLElement);
  const block = el?.closest(
    'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre'
  ) as HTMLElement | null;
  if (block) flashBlock(block);
}
