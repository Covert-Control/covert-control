import { useEffect, useState } from 'react';
import { Modal, Stack, Text, Checkbox, Group, Button, List } from '@mantine/core';

type TermsModalProps = {
  opened: boolean;
  onClose: () => void;
  onAccept: () => void | Promise<void>;
  busy?: boolean;
  title?: string;
  size?: string | number;
};

export function TermsModal({
  opened,
  onClose,
  onAccept,
  busy = false,
  title = 'Terms & Conditions',
  size = 'lg',
}: TermsModalProps) {
  const [canAcceptTerms, setCanAcceptTerms] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  // Reset internal state every time the modal opens
  useEffect(() => {
    if (opened) {
      setCanAcceptTerms(false);
      setAckChecked(false);
    }
  }, [opened]);

  const onTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 4;
    if (atBottom) setCanAcceptTerms(true);
  };

  const handleAccept = async () => {
    await onAccept();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size={size}>
      <Stack gap="sm">
        {/* Scrollable terms body */}
        <div
          onScroll={onTermsScroll}
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            paddingRight: 8,
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <Text size="sm">
            <b>By submitting a story, you agree to the following terms:</b>
          </Text>

          <Text size="sm" mt="xs">
            <b>1. Your Content:</b> You retain ownership of content you submit. By posting on the site,
            you grant Covert Control permission to host, display, and distribute your content through
            the platform as needed to operate the service. You may remove or edit your own content at
            any time.
            <br />
            <br />
            To keep the community safe and usable, content is subject to site rules and moderation.
            Content may be removed at any time if it violates rules, creates legal risk, or is otherwise
            disruptive to the platform.
            <br />
            <br />
            <b>
              Ultimately, Covert Control reserves the right to remove any story or user account for any
              reason at any time.
            </b>
            <br />
            <br />
            For this reason, ensure that you keep personal copies of your stories at all times. Do not
            rely on the site as the sole host of your work.
          </Text>

          {/* ✅ FIX: List is not inside <Text> (p) */}
          <Text size="sm" mt="xs">
            <b>2. Content Guidelines:</b>
          </Text>

          <List size="sm" spacing={6} mt="xs">
            <List.Item>
              Submissions should belong to a general theme of mind control, hypnosis, or psychological
              manipulation.
            </List.Item>
            <List.Item>
              Stories featuring underage characters (under the age of 18) are strictly prohibited. If
              characters are described as &quot;students&quot; or are otherwise in situations where their
              age is ambiguous, it should be explicitly stated that they are at least 18 years of age.
              Posting content with underage characters will likely result in immediate ban and account
              deletion.
            </List.Item>
            <List.Item>
              No doxxing or sharing private personal information. Ensure you have consent if posting a
              chat log.
            </List.Item>
            <List.Item>
              Submissions should be in the form of a story. This is not a platform for keeping baking
              recipes or other non-fictional content.
            </List.Item>
            <List.Item>No spam, scams, or attempts to manipulate the platform.</List.Item>
            <List.Item>
              Use tags accurately. Misleading or false tags may result in content removal. Please take
              the time to use tags that already exist and to avoid creating duplicate (but slightly
              different) tags unnecessarily.
            </List.Item>
            <List.Item>
              Stories featuring niche kinks that can be difficult or unnerving for some users, such as
              scat/watersports, beastiality, incest, raceplay etc. must be properly tagged.
            </List.Item>
            <List.Item>Do not post another author&apos;s story. Any proven plagiarism will be removed.</List.Item>
          </List>

          <Text size="sm" mt="xs">
            <b>
              3. Understand that the site is currently in beta. Rules are subject to change at any
              time. Continued use of the site constitutes acceptance of these terms.
            </b>
          </Text>
        </div>

        <Checkbox
          checked={ackChecked}
          onChange={(e) => setAckChecked(e.currentTarget.checked)}
          disabled={!canAcceptTerms}
          label={
            canAcceptTerms
              ? 'I have read and agree to the Terms & Conditions.'
              : 'Scroll to the bottom to enable this checkbox.'
          }
        />

        <Group justify="space-between" mt="xs">
          <Group>
            <Button variant="default" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={!ackChecked || !canAcceptTerms || busy}>
              Accept & continue
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
