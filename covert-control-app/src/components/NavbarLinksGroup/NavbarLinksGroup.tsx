// components/NavbarLinksGroup/NavbarLinksGroup.tsx
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Anchor,
  Box,
  Collapse,
  Group,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { ChevronRight } from 'lucide-react';
import classes from './NavbarLinksGroup.module.css';

interface LinksGroupProps {
  icon: React.FC<any>;
  label: string;
  link?: string; // single-link target
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
  onLinkClick?: () => void; // <-- new: close mobile navbar after navigation
}

export function LinksGroup({
  icon: Icon,
  label,
  link,
  initiallyOpened,
  links,
  onLinkClick,
}: LinksGroupProps) {
  const hasChildren = Array.isArray(links) && links.length > 0;
  const [opened, setOpened] = useState(!!initiallyOpened);

  const nestedItems = hasChildren
    ? links!.map((item) => (
        <Anchor
          component={Link}
          to={item.link}
          key={item.label}
          className={classes.link}
          onClick={onLinkClick}
        >
          {item.label}
        </Anchor>
      ))
    : null;

  // If it's just a single leaf link (no children), render one clickable row
  if (!hasChildren && link) {
    return (
      <Anchor
        component={Link}
        to={link}
        className={classes.control}
        onClick={onLinkClick}
      >
        <Group position="apart" align="center" wrap={false}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
        </Group>
      </Anchor>
    );
  }

  // Group with nested links
  return (
    <>
      <UnstyledButton
        onClick={() => setOpened((o) => !o)}
        className={classes.control}
      >
        <Group position="apart" align="center" wrap={false}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
          {hasChildren && (
            <ChevronRight
              className={classes.chevron}
              size={16}
              style={{
                transform: opened ? 'rotate(-90deg)' : undefined,
                transition: 'transform 0.2s',
              }}
            />
          )}
        </Group>
      </UnstyledButton>

      {hasChildren && <Collapse in={opened}>{nestedItems}</Collapse>}
    </>
  );
}
