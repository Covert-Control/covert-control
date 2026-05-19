import { Badge } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';

interface TagPillProps {
  tag: string;
  size?: 'xs' | 'sm' | 'md';
}

export function TagPill({ tag, size = 'xs' }: TagPillProps) {
  const navigate = useNavigate();

  return (
    <Badge
      size={size}
      radius="xl"
      variant="light"
      color="gray"
      style={{
        textTransform: 'none',
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