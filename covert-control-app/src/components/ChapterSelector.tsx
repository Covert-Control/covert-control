// src/components/ChapterSelector.tsx
import { Group, Select, Stack, Text } from '@mantine/core';

export type ChapterMeta = {
  index: number;
  title?: string | null;
  wordCount?: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type ChapterSelectorProps = {
  chapters: ChapterMeta[];
  currentChapter: number;
  onChangeChapter: (chapter: number) => void;
};

export function ChapterSelector({
  chapters,
  currentChapter,
  onChangeChapter,
}: ChapterSelectorProps) {
  if (!chapters || chapters.length === 0) return null;

  // Single chapter: just show the word count so the reader
  // can see story length at a glance
  if (chapters.length === 1) {
    const ch = chapters[0];
    if (!ch.wordCount || ch.wordCount <= 0) return null;

    return (
      <Stack gap={2} align="flex-start" style={{ minWidth: 220 }}>
        <Text size="xs" c="dimmed">
          {ch.wordCount.toLocaleString()} words
        </Text>
      </Stack>
    );
  }

  // Multiple chapters: full selector with title (+ word count when known)
  const selectData = chapters.map((ch) => {
    const title = ch.title?.trim() || `Chapter ${ch.index}`;
    const words =
      ch.wordCount && ch.wordCount > 0
        ? `${ch.wordCount.toLocaleString()} words`
        : null;
    return {
      value: String(ch.index),
      label: words ? `${ch.index}. ${title} — ${words}` : `${ch.index}. ${title}`,
    };
  });

  return (
    <Stack gap={2} align="flex-start" style={{ minWidth: 220 }}>
      <Group gap={4} align="center">
        <Select
          size="xs"
          w={260}
          data={selectData}
          value={String(currentChapter)}
          onChange={(value) => {
            const next = Number(value);
            if (!Number.isFinite(next)) return;
            onChangeChapter(next);
          }}
          clearable={false}
        />
        
      </Group>
    </Stack>
  );
}
