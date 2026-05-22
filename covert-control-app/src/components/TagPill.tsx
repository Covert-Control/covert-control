import { Badge } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';

interface TagPillProps {
  tag: string;
  size?: 'xs' | 'sm' | 'md';
}

// Priority order for sorting: dominance first, pairing second, misc last
export const GENDER_DOMINANCE_TAGS = new Set(['md', 'fd']);
export const GENDER_PAIRING_TAGS = new Set(['ff', 'mf', 'mm']);

const TAG_COLORS: Record<string, string> = {
  md: 'rgba(13, 0, 255, 1)',
  fd: 'rgba(235, 5, 5, 1)',
  ff: 'rgb(255, 0, 212)',
  mf: 'rgba(4, 196, 23, 1)',
  mm: 'cyan',
};

export function getTagSortPriority(tag: string): number {
  const t = tag.toLowerCase();
  if (GENDER_DOMINANCE_TAGS.has(t)) return 0;
  if (GENDER_PAIRING_TAGS.has(t)) return 1;
  return 2;
}

export function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => getTagSortPriority(a) - getTagSortPriority(b));
}

export function TagPill({ tag, size = 'xs' }: TagPillProps) {
  const navigate = useNavigate();
  const color = TAG_COLORS[tag.toLowerCase()] ?? 'gray';
  const isBasicTag = color !== 'gray';

  return (
    <Badge
      size={size}
      radius="xl"
      variant={isBasicTag ? 'filled' : 'light'}  // 👈 filled for colored, light for gray
      color={color}
      style={{
        textTransform: isBasicTag ? 'uppercase' : 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() =>
        navigate({
          to: '/advanced-search',
          search: { tags: [tag] },
        })
      }
    >
      {tag}
    </Badge>
  );
}