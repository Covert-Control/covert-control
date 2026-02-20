import { Anchor, Box, Flex, Group, Text, Tooltip } from '@mantine/core';
import { Link as RouterLink } from '@tanstack/react-router';

type SiteFooterProps = {
  brandName?: string;
  email?: string;
};

function Dot(props: { visibleFrom?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <Text
      size="xs"
      c="dimmed"
      style={{ lineHeight: 1, userSelect: 'none' }}
      {...props}
    >
      •
    </Text>
  );
}

export default function SiteFooter({
  brandName = 'Covert Control',
  email = 'covertcontrol2232@gmail.com',
}: SiteFooterProps) {
  const year = new Date().getFullYear();

  const subject = `${brandName} – Feedback / Suggestion`;
  const body = [
    'Note: If you are reporting a story or a user, please use the Report button on the story and describe the issue there.',
  ].join('\n');

  const mailtoHref = `mailto:${email}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return (
    <Box
      h="100%"
      px="sm"
      style={{
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <Flex
        w="100%"
        justify="space-between"
        align="center"
        style={{ minWidth: 0 }}
      >
        {/* Left: legal/copyright */}
        <Text
          size="xs"
          c="dimmed"
          style={{
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
          title={`© ${year} ${brandName}`}
        >
          © {year} {brandName}
        </Text>

        {/* Right: links (single-line, no wrap) */}
        <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Anchor
            component={RouterLink}
            to="/faq"
            size="xs"
            c="dimmed"
            underline="hover"
            style={{ lineHeight: 1, whiteSpace: 'nowrap' }}
          >
            FAQ
          </Anchor>

          <Dot />

          <Tooltip label="Coming soon" withArrow>
            <Anchor
              component="button"
              type="button"
              onClick={(e) => e.preventDefault()}
              size="xs"
              c="dimmed"
              underline="hover"
              style={{ lineHeight: 1, whiteSpace: 'nowrap' }}
            >
              Patreon
            </Anchor>
          </Tooltip>

          <Dot />

          <Tooltip
            label="For feedback/suggestions, email me. Please use the Report button on stories to report issues."
            withArrow
          >
            <Anchor
              href={mailtoHref}
              size="xs"
              c="dimmed"
              underline="hover"
              style={{ lineHeight: 1, whiteSpace: 'nowrap' }}
            >
              Contact
            </Anchor>
          </Tooltip>
        </Group>
      </Flex>
    </Box>
  );
}
