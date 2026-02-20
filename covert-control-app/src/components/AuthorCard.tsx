import { Card, Text, Badge, Group, Button, Stack, Box } from '@mantine/core';
import { UserCircle, ArrowRight } from 'lucide-react';

export interface AuthorWithStory {
  uid: string;
  username: string;
  storyCount: number;
  lastStoryTitle: string;
  lastStoryDate?: Date;
}

interface AuthorCardProps {
  author: AuthorWithStory;
}

export function AuthorCard({ author }: AuthorCardProps) {
  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <UserCircle size={32} style={{ flexShrink: 0 }} />

          <Stack gap={2} align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            {/* Name + badge */}
            <Box
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                maxWidth: '100%',
                flexWrap: 'wrap', // ✅ allows badge to wrap under name if needed
              }}
            >
              <Text
                fw={600}
                // ✅ full name visible on mobile, clamp on desktop if you still want
                style={{
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
              >
                {author.username}
              </Text>

              <Badge radius="sm" variant="light" style={{ flexShrink: 0 }}>
                {author.storyCount} {author.storyCount === 1 ? 'Story' : 'Stories'}
              </Badge>
            </Box>

            {/* Latest title: give it more lines on mobile */}
            {author.lastStoryTitle && (
              <Text
                size="sm"
                c="dimmed"
                lineClamp={3} // ✅ more readable on mobile; adjust to 2 if you want
                style={{ maxWidth: '100%' }}
              >
                Latest: {author.lastStoryTitle}
              </Text>
            )}

            {author.lastStoryDate && (
              <Text size="xs" c="dimmed">
                Updated: {author.lastStoryDate.toLocaleDateString()}
              </Text>
            )}
          </Stack>
        </Group>

        {/* ✅ Hide button on mobile to free space */}
        <Button
          variant="light"
          size="xs"
          rightSection={<ArrowRight size={14} />}
          visibleFrom="sm"
          style={{ flexShrink: 0 }}
        >
          View profile
        </Button>
      </Group>
    </Card>
  );
}
