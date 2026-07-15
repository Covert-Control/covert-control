// src/components/ReaderBookmarkLayer.tsx
//
// Overlay rendered inside the chapter reader. Two jobs:
//   1. Persistent faint markers in the left gutter for the saved "place" and
//      each "favorite section" on the current chapter (click → rename/remove).
//   2. A small toolbar that appears when the reader selects text, offering
//      "Save my place" / "Save section", anchored to the first selected line.
//
// All positions are measured from the DOM relative to `contentRef` (which must
// be position:relative). Faint by default so it stays unobtrusive in read mode.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Bookmark, ChevronRight, Highlighter, Pencil, Trash2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';

import { useUiStore } from '../stores/uiStore';
import { useBookmarks } from '../hooks/useBookmarks';
import { findBlock, getSelectionAnchor } from '../utils/bookmarkAnchor';
import { getEditorAnchorForRange } from '../utils/bookmarkEditor';
import {
  sectionDisplayName,
  type BookmarkPlace,
  type BookmarkSection,
} from '../types/bookmark';

type Props = {
  storyId: string;
  // Denormalized into the bookmark on save so the /bookmarks page needs no read.
  storyTitle?: string;
  storyUsername?: string;
  chapter: number;
  contentRef: RefObject<HTMLDivElement | null>;
  // The read-only Tiptap editor for the current chapter. Used to capture precise
  // from/to positions and to place markers via coordsAtPos. May be null briefly.
  editor: Editor | null;
  // Any value that changes when the content layout changes (chapter, font size,
  // width, reader mode, content length) — triggers a re-measure of markers.
  recomputeKey: string;
};

type Marker =
  | { kind: 'place'; top: number }
  | { kind: 'section'; top: number; section: BookmarkSection };

// The anchor captured the moment a selection is made, ready to save. Captured
// eagerly (not read at click time) so tapping a button — which collapses the
// selection on mobile — can't lose it.
type PendingAnchor =
  | { from: number; to: number; quote: string }
  | { paragraphIndex: number; quote: string };

// Anchor + where to float the toolbar (below the selection, in container coords).
type PendingSelection = { anchor: PendingAnchor; top: number; left: number };

const PLACE_COLOR = 'var(--mantine-color-blue-5)';
const SECTION_COLOR = 'var(--mantine-color-grape-5)';

export function ReaderBookmarkLayer({
  storyId,
  storyTitle,
  storyUsername,
  chapter,
  contentRef,
  editor,
  recomputeKey,
}: Props) {
  const isMobile = useMediaQuery('(max-width: 48em)') ?? false;
  const readerMode = useUiStore((s) => s.readerMode);

  const {
    place,
    sections,
    canAddSection,
    busy,
    savePlace,
    clearPlace,
    addSection,
    removeSection,
    renameSection,
  } = useBookmarks(storyId, { title: storyTitle, username: storyUsername });

  const [markers, setMarkers] = useState<Marker[]>([]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    createdAtMs: number;
    value: string;
  } | null>(null);

  // ── Measure marker positions for the current chapter ──────────────────────
  const measure = useCallback(() => {
    const container = contentRef.current;
    if (!container) {
      setMarkers([]);
      return;
    }

    const cRect = container.getBoundingClientRect();
    const scrollY = window.scrollY;

    // Viewport top of a bookmark: precise via ProseMirror coords when we have
    // from/to; otherwise (legacy bookmarks) locate the block in the DOM.
    const viewportTopFor = (item: {
      from?: number;
      paragraphIndex?: number;
      quote: string;
    }): number | null => {
      if (editor && item.from != null) {
        const size = editor.state.doc.content.size;
        if (item.from >= 0 && item.from <= size) {
          try {
            return editor.view.coordsAtPos(item.from).top;
          } catch {
            /* fall through to DOM */
          }
        }
      }
      const block = findBlock(container, item.paragraphIndex ?? -1, item.quote);
      return block ? block.getBoundingClientRect().top : null;
    };

    // Reader mode renders markers through a body portal in DOCUMENT coords, so
    // they escape the clipped/centered layout and pin to the screen edge (and
    // still scroll naturally). Otherwise they're absolute within the container.
    const toTop = (vTop: number) =>
      readerMode ? vTop + scrollY : vTop - cRect.top;

    const next: Marker[] = [];

    if (place && place.chapter === chapter) {
      const vTop = viewportTopFor(place);
      if (vTop != null) next.push({ kind: 'place', top: toTop(vTop) });
    }

    for (const section of sections) {
      if (section.chapter !== chapter) continue;
      const vTop = viewportTopFor(section);
      if (vTop != null) next.push({ kind: 'section', top: toTop(vTop), section });
    }

    setMarkers(next);
  }, [contentRef, editor, place, sections, chapter, readerMode]);

  useLayoutEffect(() => {
    measure();
    // ProseMirror lays out async after setContent — catch it on the next frame.
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [measure, recomputeKey]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    const pm = container.querySelector('.ProseMirror');
    if (pm) ro.observe(pm);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [contentRef, measure, recomputeKey]);

  // ── Track text selection within the content ───────────────────────────────
  const updateSelection = useCallback(() => {
    const container = contentRef.current;
    const domSel = window.getSelection();
    if (
      !container ||
      !domSel ||
      domSel.rangeCount === 0 ||
      domSel.isCollapsed
    ) {
      setPending(null);
      return;
    }

    const range = domSel.getRangeAt(0);
    // Only react to selections inside the chapter content.
    if (!container.contains(range.commonAncestorContainer)) {
      setPending(null);
      return;
    }

    // Prefer precise from/to; fall back to the DOM block anchor (legacy path).
    let anchor: PendingAnchor | null = null;
    const es = getEditorAnchorForRange(editor, range);
    if (es) {
      anchor = { from: es.from, to: es.to, quote: es.quote };
    } else {
      const dom = getSelectionAnchor(container);
      if (dom) anchor = { paragraphIndex: dom.paragraphIndex, quote: dom.quote };
    }
    if (!anchor) {
      setPending(null);
      return;
    }

    // Float the toolbar just BELOW the last line of the selection — native
    // selection menus sit above it, so below stays clear on Chrome/Brave/Samsung.
    const cRect = container.getBoundingClientRect();
    const rects = range.getClientRects();
    const last = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    const first = rects.length ? rects[0] : last;
    const top = last.bottom - cRect.top + 8;
    const left = Math.max(
      0,
      Math.min(first.left - cRect.left, Math.max(0, container.clientWidth - 88))
    );
    setPending({ anchor, top, left });
  }, [contentRef, editor]);

  useEffect(() => {
    const run = () => updateSelection();
    // selectionchange is the signal that fires reliably when a mobile selection
    // settles (drag-handles don't emit a usable touchend). Debounce it since it
    // fires on every adjustment; the pointer/key events keep desktop snappy.
    let timer: number | undefined;
    const debounced = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(run, 150);
    };
    document.addEventListener('selectionchange', debounced);
    document.addEventListener('mouseup', run);
    document.addEventListener('touchend', run);
    document.addEventListener('keyup', run);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('selectionchange', debounced);
      document.removeEventListener('mouseup', run);
      document.removeEventListener('touchend', run);
      document.removeEventListener('keyup', run);
    };
  }, [updateSelection]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setPending(null);
  };

  const buildAnchor = (p: PendingAnchor): BookmarkPlace =>
    'from' in p
      ? { chapter, from: p.from, to: p.to, quote: p.quote }
      : { chapter, paragraphIndex: p.paragraphIndex, quote: p.quote };

  const handleSavePlace = async () => {
    if (!pending) return;
    const ok = await savePlace(buildAnchor(pending.anchor));
    if (ok) {
      notifications.show({
        title: 'Place saved',
        message: 'Pick up here anytime from your Bookmarks.',
        color: 'blue',
        position: 'bottom-center',
      });
    }
    clearSelection();
  };

  const handleSaveSection = async () => {
    if (!pending) return;
    const ok = await addSection(buildAnchor(pending.anchor));
    if (ok) {
      notifications.show({
        title: 'Section saved',
        message: 'Find it again in your Bookmarks.',
        color: 'grape',
        position: 'bottom-center',
      });
    }
    clearSelection();
  };

  const handleRenameSave = async () => {
    if (!renameTarget) return;
    await renameSection(renameTarget.createdAtMs, renameTarget.value);
    setRenameTarget(null);
  };

  return (
    <>
      <style>{`
        .bm-marker-tab { opacity: 0.5; transition: opacity 0.15s ease; }
        .bm-marker-tab:hover { opacity: 1; }
        .bm-marker-tab:active { opacity: 1; }
        @keyframes bmFlash {
          0% { background-color: rgba(190, 75, 219, 0.28); }
          100% { background-color: transparent; }
        }
        .bm-flash { animation: bmFlash 1.8s ease; border-radius: 4px; }
        ::highlight(bm-flash) {
          background-color: rgba(190, 75, 219, 0.30);
          border-radius: 2px;
        }
      `}</style>

      {markers.map((m) => {
        const color = m.kind === 'place' ? PLACE_COLOR : SECTION_COLOR;
        const key = m.kind === 'place' ? 'place' : `s-${m.section.createdAtMs}`;
        const box = (
          <Box
            key={key}
            style={
              readerMode
                ? {
                    // Portaled to <body> in document coords, pinned to the edge.
                    position: 'absolute',
                    top: m.top,
                    left: isMobile ? 2 : 8,
                    zIndex: 190,
                  }
                : {
                    // Absolute within the content container, in the gutter.
                    position: 'absolute',
                    top: m.top,
                    left: isMobile ? -12 : -18,
                    zIndex: 3,
                  }
            }
          >
            <Menu position="right-start" shadow="md" width={220} withArrow>
              <Menu.Target>
                {/* Solid rounded tab hugging the left edge — visible + tappable
                    on both mobile and desktop (desktop previously used a faint
                    thin bar that was hard to see). */}
                <UnstyledButton
                  className="bm-marker-tab"
                  aria-label={
                    m.kind === 'place' ? 'Saved place' : 'Saved section'
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    width: 17,
                    height: 26,
                    paddingRight: 2,
                    borderRadius: '0 6px 6px 0',
                    background: color,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
                  }}
                >
                  {m.kind === 'place' ? (
                    <Bookmark size={13} color="#fff" fill="#fff" />
                  ) : (
                    <ChevronRight size={14} color="#fff" strokeWidth={2.5} />
                  )}
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {m.kind === 'place' ? (
                  <>
                    <Menu.Label>Your saved place</Menu.Label>
                    <Menu.Item
                      color="red"
                      leftSection={<Trash2 size={14} />}
                      onClick={() => clearPlace()}
                    >
                      Remove place
                    </Menu.Item>
                  </>
                ) : (
                  <>
                    <Menu.Label>{sectionDisplayName(m.section)}</Menu.Label>
                    <Menu.Item
                      leftSection={<Pencil size={14} />}
                      onClick={() =>
                        setRenameTarget({
                          createdAtMs: m.section.createdAtMs,
                          value: m.section.label ?? '',
                        })
                      }
                    >
                      Rename
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      leftSection={<Trash2 size={14} />}
                      onClick={() => removeSection(m.section.createdAtMs)}
                    >
                      Remove
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Box>
        );

        return readerMode ? createPortal(box, document.body, key) : box;
      })}

      {pending && (
        // Floats just below the selected text. Native selection menus appear
        // ABOVE the selection (and Chrome's can dock at the screen bottom), so
        // placing ours below keeps it clear on Chrome/Brave/Samsung/Firefox.
        <Paper
          shadow="md"
          radius="md"
          withBorder
          // Don't steal focus / collapse the selection on desktop mousedown.
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: pending.top,
            left: pending.left,
            zIndex: 5,
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            padding: 4,
            background: 'var(--mantine-color-body)',
          }}
        >
          <Tooltip label="Save my place" withArrow>
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={handleSavePlace}
              loading={busy}
              aria-label="Save my place"
            >
              <Bookmark size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={canAddSection ? 'Save section' : 'Section limit reached'}
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="grape"
              onClick={handleSaveSection}
              loading={busy}
              disabled={!canAddSection}
              aria-label="Save section"
            >
              <Highlighter size={16} />
            </ActionIcon>
          </Tooltip>
        </Paper>
      )}

      <Modal
        opened={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename section"
        centered
        size="sm"
      >
        <TextInput
          value={renameTarget?.value ?? ''}
          onChange={(e) => {
            // Capture the value now — React nulls e.currentTarget before the
            // functional state updater runs, so reading it lazily crashes.
            const value = e.currentTarget.value;
            setRenameTarget((t) => (t ? { ...t, value } : t));
          }}
          placeholder="Section name (optional)"
          maxLength={60}
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setRenameTarget(null)}>
            Cancel
          </Button>
          <Button onClick={handleRenameSave} loading={busy}>
            Save
          </Button>
        </Group>
      </Modal>
    </>
  );
}
