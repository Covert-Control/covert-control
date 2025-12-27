// src/components/ChapterSelector.tsx
import { useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  Group,
  Text,
  Center,
  Loader,
  ScrollArea,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ChevronDown, ListOrdered } from 'lucide-react';

type ChapterSelectorProps = {
  storyId: string;
  currentChapter: number;
  totalChapters: number;
  onNavigate: (chapter: number) => void;
};

type ChapterMeta = {
  id: string;
  index: number;
  title: string;
  wordCount?: number | null;
  createdAt?: Date | null;
};

function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return undefined;
}

function formatShortDate(d?: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ChapterSelector({
  storyId,
  currentChapter,
  totalChapters,
  onNavigate,
}: ChapterSelectorProps) {
  // Only useful when there are multiple chapters
  if (!storyId || totalChapters <= 1) return null;

  const [opened, setOpened] = useState(false);

  const chaptersQuery = useQuery({
    queryKey: ['storyChaptersList', storyId],
    // Always fetch once per story view; selector just controls visibility
    enabled: !!storyId,
    queryFn: async (): Promise<ChapterMeta[]> => {
      const colRef = collection(db, 'stories', storyId, 'chapters');
      const q = query(colRef, orderBy('index', 'asc'));
      const snap = await getDocs(q);

      return snap.docs.map((docSnap) => {
        const d = docSnap.data() as any;
        return {
          id: docSnap.id,
          index:
            typeof d.index === 'number'
              ? d.index
              : Number(docSnap.id) || 1,
          title:
            d.chapterTitle?.trim() ||
            d.title?.trim() ||
            `Chapter ${d.index ?? docSnap.id}`,
          wordCount:
            typeof d.wordCount === 'number' ? d.wordCount : undefined,
          createdAt: toDate(d.createdAt),
        };
      });
    },
    staleTime: 1000 * 60 * 10,
  });

  const chapters = chaptersQuery.data ?? [];

  const toggle = () => setOpened((v) => !v);

  return (
    <Box mt="xs">
      <Button
        variant="subtle"
        size="xs"
        onClick={toggle}
        rightSection={
          <ChevronDown
            size={16}
            style={{
              transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
        }
      >
        <Group gap={6}>
          <ListOrdered size={16} />
          <Text size="xs">
            Chapters ({totalChapters}) — currently on {currentChapter}
          </Text>
        </Group>
      </Button>

      <Collapse in={opened}>
        <Box
          mt="xs"
          style={{
            borderRadius: 8,
            border: '1px solid var(--mantine-color-gray-3)',
            overflow: 'hidden',
          }}
        >
          {chaptersQuery.isLoading ? (
            <Center py="sm">
              <Loader size="sm" />
            </Center>
          ) : chaptersQuery.isError ? (
            <Text size="xs" c="red" px="sm" py="xs">
              Could not load chapter list.
            </Text>
          ) : chapters.length === 0 ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">
              No chapters found.
            </Text>
          ) : (
            <ScrollArea
              style={{ maxHeight: 260 }}
              offsetScrollbars
              type="auto"
            >
              <Box px="sm" py="xs">
                {chapters.map((ch) => {
                  const wc =
                    typeof ch.wordCount === 'number'
                      ? `${ch.wordCount.toLocaleString()} word${
                          ch.wordCount === 1 ? '' : 's'
                        }`
                      : null;
                  const dateLabel = formatShortDate(ch.createdAt);
                  const meta =
                    wc && dateLabel
                      ? `${wc} • ${dateLabel}`
                      : wc || dateLabel || '';

                  const isActive = ch.index === currentChapter;

                  return (
                    <Box
                      key={ch.id}
                      onClick={() => onNavigate(ch.index)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        backgroundColor: isActive
                          ? 'var(--mantine-color-blue-light)'
                          : 'transparent',
                        color: isActive
                          ? 'var(--mantine-color-blue-light-color)'
                          : 'inherit',
                        marginBottom: 2,
                      }}
                    >
                      <Text
                        size="sm"
                        fw={isActive ? 600 : 500}
                        style={{ wordBreak: 'break-word' }}
                      >
                        {ch.index}. {ch.title}
                      </Text>
                      {meta && (
                        <Text size="xs" c={isActive ? 'inherit' : 'dimmed'}>
                          {meta}
                        </Text>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </ScrollArea>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
