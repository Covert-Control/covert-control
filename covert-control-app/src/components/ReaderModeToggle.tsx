import { ActionIcon, Affix, Button, Tooltip } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
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

  // Esc always exits reader mode
  useHotkeys([['Escape', () => setReaderMode(false)]]);

  if (variant === 'enter') {
    // Only show "Enter" when not already in reader mode
    if (readerMode) return null;

    return (
      <Button
        size={size}
        variant="light"
        leftSection={<BookOpen size={16} />}
        onClick={() => setReaderMode(true)}
      >
        Reader mode
      </Button>
    );
  }

  // variant === 'exit'
  if (!readerMode) return null;

  return (
    <Affix position={{ bottom: 16, right: 16 }}>
        <Tooltip label="Exit reader mode (Esc)" withArrow position="left">
        <ActionIcon
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
    </Affix>
  );
}
