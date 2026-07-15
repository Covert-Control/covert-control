//FAQ.lazy.tsx
import { useEffect, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Affix,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  List,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Transition,
  UnstyledButton,
  rem,
} from '@mantine/core';
import { useWindowScroll } from '@mantine/hooks';
import {
  ArrowUp,
  Bookmark,
  Flag,
  HeartHandshake,
  HelpCircle,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const Route = createLazyFileRoute('/faq')({
  component: FaqPage,
});

type SectionMeta = {
  id: string;
  tocLabel: string;
  heading: string;
  icon: typeof Sparkles;
  color: string;
};

const SECTIONS: SectionMeta[] = [
  { id: 'site-features', tocLabel: 'Site features', heading: 'Site features', icon: Sparkles, color: 'blue' },
  { id: 'using-bookmarks', tocLabel: 'Using bookmarks', heading: 'Using bookmarks', icon: Bookmark, color: 'grape' },
  {
    id: 'content-terms-guidelines',
    tocLabel: 'Terms & guidelines',
    heading: 'Content Terms and Guidelines',
    icon: ShieldCheck,
    color: 'teal',
  },
  { id: 'reporting-content', tocLabel: 'Reporting content', heading: 'Reporting Content', icon: Flag, color: 'orange' },
  { id: 'contact-info', tocLabel: 'Contact info', heading: 'Contact info', icon: Mail, color: 'cyan' },
  { id: 'supporting-site', tocLabel: 'Supporting the site', heading: 'Supporting the site', icon: HeartHandshake, color: 'pink' },
];

const META = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<string, SectionMeta>;

// Helps ensure headings don’t end up hidden behind AppShell.Header
const headingScrollMarginTop = 'calc(var(--app-shell-header-height, 60px) + var(--mantine-spacing-lg))';
const stickyTop = 'calc(var(--app-shell-header-height, 60px) + var(--mantine-spacing-md))';

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  // Keep URL hash in sync (nice for sharing links)
  if (window.location.hash !== `#${id}`) {
    window.history.replaceState(null, '', `#${id}`);
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Tracks which section is currently in view for the scroll-spy TOC. */
function useActiveSection(): string {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // Pick the section nearest the top of the detection band.
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActiveId(topmost.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0 }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return activeId;
}

function SectionCard({ section, children }: { section: SectionMeta; children: React.ReactNode }) {
  const Icon = section.icon;
  return (
    <Paper
      id={section.id}
      withBorder
      radius="lg"
      p="lg"
      shadow="sm"
      style={{
        scrollMarginTop: headingScrollMarginTop,
        borderLeft: `4px solid var(--mantine-color-${section.color}-6)`,
      }}
    >
      <Group gap="sm" mb="md" wrap="nowrap">
        <ThemeIcon variant="light" color={section.color} size={40} radius="md">
          <Icon size={20} />
        </ThemeIcon>
        <Title order={2} style={{ fontSize: rem(21), lineHeight: 1.2 }}>
          {section.heading}
        </Title>
      </Group>
      <Stack gap="sm">{children}</Stack>
    </Paper>
  );
}

/** Sticky, scroll-spy table of contents (desktop). */
function TableOfContents({ activeId }: { activeId: string }) {
  return (
    <Paper withBorder radius="lg" p="md" shadow="sm">
      <Text fw={700} size="xs" c="dimmed" mb="sm" style={{ letterSpacing: '0.08em' }}>
        ON THIS PAGE
      </Text>
      <Stack gap={2}>
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = activeId === s.id;
          return (
            <UnstyledButton
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              style={{
                padding: `${rem(6)} ${rem(8)}`,
                borderRadius: rem(8),
                background: active ? `var(--mantine-color-${s.color}-light)` : 'transparent',
                transition: 'background 120ms ease',
              }}
            >
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon variant={active ? 'filled' : 'light'} color={s.color} size={24} radius="sm">
                  <Icon size={14} />
                </ThemeIcon>
                <Text size="sm" fw={active ? 600 : 400} c={active ? undefined : 'dimmed'} lineClamp={1}>
                  {s.tocLabel}
                </Text>
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>
    </Paper>
  );
}

function FaqPage() {
  const activeId = useActiveSection();
  const [scroll, scrollTo] = useWindowScroll();

  // If the page is opened with a #hash, scroll to it once mounted.
  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (id) {
      // Defer so the layout has settled.
      requestAnimationFrame(() => scrollToSection(id));
    }
  }, []);

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* HERO */}
        <Paper
          radius="lg"
          p={{ base: 'lg', sm: 'xl' }}
          style={{
            background:
              'linear-gradient(135deg, var(--mantine-color-grape-7) 0%, var(--mantine-color-indigo-7) 100%)',
            color: 'white',
            overflow: 'hidden',
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Box>
              <Group gap="sm" mb="sm" wrap="nowrap">
                <ThemeIcon variant="white" color="grape" size={46} radius="md">
                  <HelpCircle size={26} />
                </ThemeIcon>
                <Title order={1} c="white" style={{ fontSize: rem(30), lineHeight: 1.15 }}>
                  Frequently Asked Questions
                </Title>
              </Group>
              <Text c="white" style={{ opacity: 0.9, maxWidth: rem(600) }}>
                Everything about reading, writing, bookmarks, rules, and getting in touch. The site is
                currently in beta, so rules and features are subject to change as needed.
              </Text>
            </Box>

            <Badge size="lg" variant="white" color="grape" radius="sm" visibleFrom="xs">
              Beta
            </Badge>
          </Group>
        </Paper>

        {/* MOBILE QUICK-JUMP PILLS */}
        <Group gap="xs" hiddenFrom="md">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = activeId === s.id;
            return (
              <Button
                key={s.id}
                size="xs"
                radius="xl"
                color={s.color}
                variant={active ? 'filled' : 'light'}
                leftSection={<Icon size={14} />}
                onClick={() => scrollToSection(s.id)}
              >
                {s.tocLabel}
              </Button>
            );
          })}
        </Group>

        {/* CONTENT + STICKY TOC */}
        <Box style={{ display: 'flex', gap: 'var(--mantine-spacing-xl)', alignItems: 'flex-start' }}>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Stack gap="lg">
              <SectionCard section={META['site-features']}>
                <Text size="sm">
                  Covert Control is a fiction platform focused on mind-control and hypnosis themed erotica.
                </Text>

                <List size="sm" spacing={6}>
                  <List.Item>Read stories with personalized combinations of colors, fonts, and text sizes. Settings can be saved across the site using your account. Access these by clicking the "Display" button in the story header.</List.Item>
                  <List.Item>Hide the interface while reading a book-like experience. Press the "Hide UI" button in the story header to activate reader mode.</List.Item>
                  <List.Item>Submit, edit, and add chapters for your own stories at any time.</List.Item>
                  <List.Item>A robust tagging system for stories to compliment the advanced search page.</List.Item>
                  <List.Item>A favorites system so you can easily keep track of the stories you like.</List.Item>
                  <List.Item>Keep one bookmark per story to save your place in longer texts. See "Using bookmarks" section for how to use.</List.Item>
                  <List.Item>Save up to 15 "saved sections" per story, allowing you to quickly return to the best parts of your favorite stories. See "Using bookmarks" section.</List.Item>
                  <List.Item>Stories have "likes" and view counts, allowing you to see how well your stories are doing.</List.Item>
                  <List.Item>Find stories in a few ways: browsing all by most recent, searching by tags and key words, getting three random stories from the full database, or seeing everything submitted from the previous week.</List.Item>
                  <List.Item>Reporting tools to flag content or user behavior that violates site rules.</List.Item>
                </List>
              </SectionCard>

              <SectionCard section={META['using-bookmarks']}>
                <Text size="sm">
                  There are two ways of saving a place in a story: bookmarks and saved sections:
                </Text>

                <List size="sm" spacing={6}>
                  <List.Item>
                    <strong>Bookmarks</strong> — 1 per story. This is a single placeholder for where you left off reading. 
                  </List.Item>
                  <List.Item>
                    <strong>Favorite sections</strong> — 10 per story. These are highlighted passages you can jump back to and re-read over and over. You can rename these (e.g., "When the vampire finally bites her victim").
                  </List.Item>
                </List>

                <Text size="sm" fw={600}>
                  To save a bookmark or passage:
                </Text>
                <List size="sm" spacing={6}>
                  <List.Item>While reading a story, select (highlight) some text at the spot you want to bookmark.</List.Item>
                  <List.Item>
                    A small toolbar appears just below your selection with two buttons: <strong>Save my place</strong> and <strong>Save section</strong>.
                  </List.Item>
                  <List.Item>Pick one — the bookmark or passage will save a section of the highlighted text (bookmarks will default to the uppermost line selected)</List.Item>
                </List>

                <Text size="sm" fw={600}>
                  Finding and managing them:
                </Text>
                <List size="sm" spacing={6}>
                  <List.Item>
                    Saved spots will show a small marker in the left margin of the story itself. Click or tap a marker to rename or remove that bookmark.
                  </List.Item>
                  <List.Item>
                    Open the <strong>Bookmarks</strong> page from either the navbar or your account menu in the top right of the header (or visit covert-control.com/bookmarks) to see all of your bookmarks and sections in one place, grouped by story. Bookmarks and saved sections will both appear under the same story title if you have both. Saved sections can also be renamed here.
                  </List.Item>
                  <List.Item>
                    Click a bookmark or section's title there to jump straight back to the exact passage, which is briefly highlighted so it's easy to spot.
                  </List.Item>
                </List>

                <Text size="sm" c="dimmed">
                  You need to be signed in with a verified email to save bookmarks. They're stored on your account, so they stay with you across devices.
                </Text>
              </SectionCard>

              <SectionCard section={META['content-terms-guidelines']}>
                <Text size="sm">
                  You retain ownership of content you submit. By posting on the site, you grant Covert Control permission to host,
                  display, and distribute your content through the platform as needed to operate the service. You may remove your own content at any time.
                </Text>

                <Text size="sm">
                  To keep the community safe and usable, content is subject to site rules and moderation. Content may be removed at
                  any time if it violates rules, creates legal risk, or is otherwise disruptive to the platform.
                </Text>

                <Alert
                  variant="light"
                  color="red"
                  radius="md"
                  icon={<ShieldAlert size={18} />}
                  title="Important"
                >
                  <Text size="sm" fw={600}>
                    Ultimately, I reserve the right to remove any story or user account for any reason at any time.
                  </Text>
                  <Text size="sm" mt={6}>
                    For this reason, ensure that you keep personal copies of your stories at all times. Do not rely on the site as the sole host of your work.
                  </Text>
                </Alert>

                <Text size="sm" fw={600}>
                  General guidelines:
                </Text>
                <List size="sm" spacing={6}>
                  <List.Item>Submissions should belong to a general theme of mind control, hypnosis, or psychological manipulation.</List.Item>
                  <List.Item>Stories featuring underage characters (under the age of 18) are strictly prohibited. If characters are described as "students" or are otherwise in situations where their age is ambiguous, it should be explicitly stated that they are at least 18 years of age. Posting content with underage characters will likely result in immediate ban and account deletion.</List.Item>
                  <List.Item>No doxxing or sharing private personal information. Ensure you have consent if posting a chat log.</List.Item>
                  <List.Item>Inductions and similar content are acceptable, but must be clearly labeled as such.</List.Item>
                  <List.Item>No spam, scams, or attempts to manipulate the platform. Extremely low effort content may be removed.</List.Item>
                  <List.Item>
                    Use tags accurately. Misleading or false tags may result in content removal. Please take the time to use tags that already exist and to avoid creating duplicate (but slightly different) tags unnecessarily.
                  </List.Item>
                  <List.Item>Stories featuring niche kinks that can be difficult or unnerving for some users, such as scat/watersports, beastiality, incest, raceplay etc. must be properly tagged. As the admin, I may add tags to stories as I see fit (however admins will never touch the content of a story itself).</List.Item>
                  <List.Item>Do not post another author's story. Any proven plagiarism will be removed.</List.Item>
                </List>

                <Text size="sm" c="dimmed">
                  Note: These rules are subject to change at any time. For specific questions, please use the contact info in the site footer.
                </Text>
              </SectionCard>

              <SectionCard section={META['reporting-content']}>
                <Text size="sm" fw={600}>
                  If you want to report a story or a user:
                </Text>

                <List size="sm" spacing={6}>
                  <List.Item>
                    Use the <strong>Report</strong> flag button on the story header and describe the issue there.
                  </List.Item>
                  <List.Item>
                    Include details: what rule is being violated, where it appears (chapter/section), and any relevant context.
                  </List.Item>
                  <List.Item>
                    Do not use the site contact email or email for reporting stories. This helps keep reports organized and actionable.
                  </List.Item>
                </List>

                <Text size="sm" c="dimmed">
                  Reports are reviewed as time allows. Repeated false or abusive reporting may result in account restrictions.
                </Text>
              </SectionCard>

              <SectionCard section={META['contact-info']}>
                <Text size="sm">
                  For feedback, suggestions, or general questions, email:{' '}
                  <Anchor href="mailto:covertcontrol2232@gmail.com" underline="hover">
                    covertcontrol2232@gmail.com
                  </Anchor>
                </Text>

                <Text size="sm">
                  Or join us on our{' '}
                  <Anchor href="https://discord.gg/XvdAeMtKZ" underline="hover">
                    Discord
                  </Anchor>
                </Text>

                <Text size="sm">
                  For reporting a story or a user, please use the <strong>Report</strong> button on the story instead of emailing.
                  This helps keep reports organized and actionable.
                </Text>
              </SectionCard>

              <SectionCard section={META['supporting-site']}>
                <Text size="sm">
                  A Patreon link will be added once it is available. It is my sincere wish to keep the site free of ads or any kind of paywall. However, hosting not only the site but also using Firebase (which is used for authentication and data storage) will cost money. Please consider donating to help keep the site running once the Patreon is available.
                </Text>

                <Text size="sm" fw={600}>
                  In the meantime, you can help by:
                </Text>
                <List size="sm" spacing={6}>
                  <List.Item>Sharing the site with readers and writers who would enjoy it.</List.Item>
                  <List.Item>Submitting constructive feedback via email or on Discord.</List.Item>
                  <List.Item>Reporting stories that violate community guidelines.</List.Item>
                </List>
              </SectionCard>
            </Stack>
          </Box>

          <Box
            visibleFrom="md"
            style={{ position: 'sticky', top: stickyTop, width: rem(240), flexShrink: 0 }}
          >
            <TableOfContents activeId={activeId} />
          </Box>
        </Box>
      </Stack>

      {/* BACK TO TOP */}
      <Affix position={{ bottom: 56, right: 24 }}>
        <Transition transition="slide-up" mounted={scroll.y > 400}>
          {(styles) => (
            <ActionIcon
              style={styles}
              onClick={() => scrollTo({ y: 0 })}
              size="lg"
              radius="xl"
              variant="filled"
              color="grape"
              aria-label="Back to top"
            >
              <ArrowUp size={18} />
            </ActionIcon>
          )}
        </Transition>
      </Affix>
    </Container>
  );
}
