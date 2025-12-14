import { Card, Text, Badge, Group, Button } from '@mantine/core';
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
        <Group gap="sm" wrap="nowrap">
          <UserCircle size={32} />

          <div>
            <Group gap="xs" justify="space-between">
              <Text fw={600}>{author.username}</Text>
              <Badge radius="sm" variant="light">
                {author.storyCount} {author.storyCount === 1 ? 'Story' : 'Stories'}
              </Badge>
            </Group>

            {author.lastStoryTitle && (
              <Text size="sm" c="dimmed" lineClamp={1}>
                Latest: {author.lastStoryTitle}
              </Text>
            )}

            {author.lastStoryDate && (
              <Text size="xs" c="dimmed">
                Updated: {author.lastStoryDate.toLocaleDateString()}
              </Text>
            )}
          </div>
        </Group>

        {/* This button is still visible, but navigation is handled by the parent Link */}
        <Button variant="light" size="xs" rightSection={<ArrowRight size={14} />}>
          View profile
        </Button>
      </Group>
    </Card>
  );
}
