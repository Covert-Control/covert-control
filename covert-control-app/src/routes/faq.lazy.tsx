import { createLazyFileRoute } from '@tanstack/react-router';
import {
  Anchor,
  Box,
  Container,
  Divider,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';

export const Route = createLazyFileRoute('/faq')({
  component: FaqPage,
});

type SectionDef = {
  id: string;
  tocLabel: string;     // e.g. "1. Site features"
  heading: string;      // e.g. "Site features"
};

const SECTIONS: SectionDef[] = [
  { id: 'site-features', tocLabel: 'Site features', heading: 'Site features' },
  {
    id: 'content-terms-guidelines',
    tocLabel: 'Content Terms and Guidelines',
    heading: 'Content Terms and Guidelines',
  },
  { id: 'reporting-content', tocLabel: 'Reporting Content', heading: 'Reporting Content' },
  { id: 'contact-info', tocLabel: 'Contact info', heading: 'Contact info' },
  { id: 'supporting-site', tocLabel: 'Supporting the site', heading: 'Supporting the site' },
];

// Helps ensure headings don’t end up hidden behind AppShell.Header
const headingScrollMarginTop = 'calc(var(--app-shell-header-height, 0px) + var(--mantine-spacing-md))';

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  // Keep URL hash in sync (nice for sharing links)
  if (window.location.hash !== `#${id}`) {
    window.history.replaceState(null, '', `#${id}`);
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Section(props: { id: string; heading: string; children: React.ReactNode }) {
  return (
    <Stack gap="xs">
      <Title order={2} id={props.id} style={{ scrollMarginTop: headingScrollMarginTop }}>
        {props.heading}
      </Title>
      {props.children}
    </Stack>
  );
}

function FaqPage() {
  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Box>
          <Title order={1}>FAQ</Title>
          <Text c="dimmed" size="sm" mt={6}>
            The site is currently in beta. Rules and features are subject to change as needed. 
          </Text>
        </Box>

        <Paper withBorder p="md">
          <Text fw={600} size="sm" mb="xs">
            On this page
          </Text>

          <List
            type="ordered"
            spacing={4}
            size="sm"
            styles={{
              itemLabel: { lineHeight: 1.25 },
            }}
          >
            {SECTIONS.map((s) => (
              <List.Item key={s.id}>
                <Anchor
                  href={`#${s.id}`}
                  underline="hover"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(s.id);
                  }}
                >
                  {s.tocLabel}
                </Anchor>
              </List.Item>
            ))}
          </List>
        </Paper>

        <Divider />

        <Section id="site-features" heading="Site features">
          <Text size="sm">
            Covert Control is a short-fiction platform focused on mind-control and hypnosis erotica. 
          </Text>

          <List size="sm" spacing={6}>
            <List.Item>Read stories with a variety of color schemes and fonts, as well as a "reader mode" that hides the UI.</List.Item>
            <List.Item>Submit, edit, and add chapters for your own stories at any time.</List.Item>
            <List.Item>A tagging system to compliment an advanced search algorithm to make finding what you want easy.</List.Item>
            <List.Item>Reporting tools to flag content or user behavior that violates site rules.</List.Item>
            <List.Item>A favorites system so you can easily keep track of the stories you like.</List.Item>
            <List.Item>The ability to 'like' a story and track trending or popular stories.</List.Item>
          </List>
        </Section>

        <Divider />

        <Section id="content-terms-guidelines" heading="Content Terms and Guidelines">
          <Text size="sm">
            You retain ownership of content you submit. By posting on the site, you grant Covert Control permission to host,
            display, and distribute your content through the platform as needed to operate the service. You may remove your own content at any time.
          </Text>

          <Text size="sm">
            To keep the community safe and usable, content is subject to site rules and moderation. Content may be removed at
            any time if it violates rules, creates legal risk, or is otherwise disruptive to the platform. 
            <br />
          </Text>
          <Text size="lg">
            <strong>Ultimately, I reserve the right to remove any story or user account for any reason at any time.</strong>
          </Text>

          <Text>
            For this reason, ensure that you keep personal copies of your stories at all times. Do not rely on the site as the sole host of your work.
          </Text>

          <Text size="sm" fw={600}>
            General guidelines:
          </Text>
          <List size="sm" spacing={6}>
            <List.Item>Submissions should belong to a general theme of mind control, hypnosis, or psychological manipulation.</List.Item>
            <List.Item>Stories featuring underage characters (under the age of 18) are strictly prohibited. If characters are described as "students" or are otherwise in situations where their age is ambiguous, it should be explicitly stated that they are at least 18 years of age. Posting content with underage characters will likely result in immediate ban and account deletion.</List.Item>
            <List.Item>No doxxing or sharing private personal information. Ensure you have consent if posting a chat log.</List.Item>
            <List.Item>Submissions should be in the form of a story. This is not a platform for keeping baking recipes or other non-fictional content.</List.Item>
            <List.Item>No spam, scams, or attempts to manipulate the platform.</List.Item>
            <List.Item>
              Use tags accurately. Misleading or false tags may result in content removal. Please take the time to use tags that already exist and to avoid creating duplicate (but slightly different) tags unnecessarily.
            </List.Item>
            <List.Item>Stories featuring niche kinks that can be difficult or unnerving for some users, such as scat/watersports, beastiality, incest, raceplay etc. must be properly tagged.</List.Item>
            <List.Item>
              Do not post another author's story. Any proven plagiarism will be removed.
            </List.Item>
          </List>

          <Text size="sm" c="dimmed">
            Note: These rules are subject to change at any time. For specific questions, please use the contact info in the site footer.
          </Text>
        </Section>

        <Divider />

        <Section id="reporting-content" heading="Reporting Content">
          <Text size="sm" fw={600}>
            If you want to report a story or a user:
          </Text>

          <List size="sm" spacing={6}>
            <List.Item>
              Use the <strong>Report</strong> button on the story and describe the issue there.
            </List.Item>
            <List.Item>
              Include details: what rule is being violated, where it appears (chapter/section), and any relevant context.
            </List.Item>
            <List.Item>
              Do not engage or escalate in public comments—reporting is the fastest way to get moderator review.
            </List.Item>
          </List>

          <Text size="sm" c="dimmed">
            Reports are reviewed as time allows. Repeated false or abusive reporting may result in account restrictions.
          </Text>
        </Section>

        <Divider />

        <Section id="contact-info" heading="Contact info">
          <Text size="sm">
            For feedback, suggestions, or general questions, email:{' '}
            <Anchor href="mailto:covertcontrol2232@gmail.com" underline="hover">
              covertcontrol2232@gmail.com
            </Anchor>
          </Text>

          <Text size="sm">
            For reporting a story or a user, please use the <strong>Report</strong> button on the story instead of emailing.
            This helps keep reports organized and actionable.
          </Text>
        </Section>

        <Divider />

        <Section id="supporting-site" heading="Supporting the site">
          <Text size="sm">
            Support options will expand over time. A Patreon link will be added once it is available.
          </Text>

          <Text size="sm" fw={600}>
            In the meantime, you can help by:
          </Text>
          <List size="sm" spacing={6}>
            <List.Item>Sharing the site with readers and writers who would enjoy it.</List.Item>
            <List.Item>Submitting constructive feedback via email.</List.Item>
            <List.Item>Reporting policy violations so the platform stays healthy.</List.Item>
          </List>
        </Section>
      </Stack>
    </Container>
  );
}
