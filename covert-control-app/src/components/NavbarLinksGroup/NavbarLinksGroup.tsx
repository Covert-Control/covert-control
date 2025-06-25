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
  link?: string;    // single‐link target
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
}

export function LinksGroup({
  icon: Icon,
  label,
  link,
  initiallyOpened,
  links,
}: LinksGroupProps) {
  const hasChildren = Array.isArray(links) && links.length > 0;
  const [opened, setOpened] = useState(!!initiallyOpened);

  // Leaf items use Mantine Anchor + TanStack Link
  const nestedItems = hasChildren
    ? links!.map((item) => (
        <Anchor
          component={Link}
          to={item.link}
          key={item.label}
          className={classes.link}
        >
          {item.label}
        </Anchor>
      ))
    : null;

  // Decide control wrapper: if group → UnstyledButton, else Anchor
  const Control: React.FC<any> = hasChildren
    ? UnstyledButton
    : (props) => <Anchor component={Link} {...props} to={link!} />;

  return (
    <>
      <Control
        onClick={hasChildren ? () => setOpened((o) => !o) : undefined}
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
      </Control>

      {hasChildren && <Collapse in={opened}>{nestedItems}</Collapse>}
    </>
  );
}