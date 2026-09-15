import { ActionIcon, Affix, Button, Tooltip } from '@mantine/core';
import { useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import { useUiStore } from '../stores/uiStore';

type Props = {
  /** Place this inside the story reader header panel */
  variant: 'enter' | 'exit';
  /** Optional: compact styling */
  size?: 'xs' | 'sm' | 'md';
};

export function ReaderModeToggle({ variant, size = 'xs' }: Props) {
  const readerMode = useUiStore((s) => s.readerMode);
  const setReaderMode = useUiStore((s) => s.setReaderMode);

  // Esc exits reader mode. A direct window listener (rather than Mantine's
  // useHotkeys) guarantees it fires even when focus is inside the reader's
  // TipTap content area, which useHotkeys skips by default. Only active while
  // reader mode is on.
  useEffect(() => {
    if (!readerMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setReaderMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readerMode, setReaderMode]);

  if (variant === 'enter') {
    // Only show "Enter" when not already in reader mode
    if (readerMode) return null;

    return (
      <Tooltip label="Hide the interface for distraction-free reading" withArrow position="top">
        <Button
          size={size}
          variant="subtle"
          radius="md"
          leftSection={<BookOpen size={14} />}
          onClick={() => setReaderMode(true)}
        >
          Hide UI
        </Button>
      </Tooltip>
    );
  }

  // variant === 'exit'
  if (!readerMode) return null;

  return (
    <Affix position={{ bottom: 16, right: 16 }}>
      {/*
        Attention cue: when the exit button appears it bounces once at full
        opacity, holds, then settles to its resting semi-transparent state so
        readers can find it. Pure CSS — no animation library.

        The bounce (transform) lives on the wrapper <div>, and the opacity fade
        on the button (where it also drives the hover/focus brighten). Both
        share the same 1.6s duration so they stay in sync. The bounce is a small,
        one-time discoverability cue, so it intentionally plays regardless of
        prefers-reduced-motion (it's not decorative motion — it's how readers
        find the exit control).
      */}
      <style>{`
        @keyframes readerExitBounce {
          0%   { transform: scale(1); }
          18%  { transform: scale(1.18); }
          36%  { transform: scale(0.97); }
          52%  { transform: scale(1.08); }
          68%  { transform: scale(1); }
          100% { transform: scale(1); }
        }
        @keyframes readerExitDim {
          0%, 80% { opacity: 1; }
          100%    { opacity: 0.25; }
        }
        .reader-exit-bounce { animation: readerExitBounce 1.6s ease; transform-origin: center; }
        .reader-exit-btn    { animation: readerExitDim 1.6s ease; }
      `}</style>
      <div className="reader-exit-bounce" style={{ display: 'inline-flex' }}>
        <Tooltip label="Exit reader mode (Esc)" withArrow position="left">
          <ActionIcon
            className="reader-exit-btn"
            size="lg"
            radius="xl"
            variant="filled"
            aria-label="Exit reader mode"
            onClick={() => setReaderMode(false)}
            style={{
              opacity: 0.25,
              transition: 'opacity 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.25';
            }}
            onFocus={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onBlur={(e) => {
              e.currentTarget.style.opacity = '0.25';
            }}
          >
            <X size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </Affix>
  );
}
