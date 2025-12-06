import { useEffect, useState } from 'react';
import { Modal, Stack, Text, Checkbox, Group, Button } from '@mantine/core';

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
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      size={size}
    >
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
          {/* TODO: Replace with your real terms text/markup */}
          <Text size="sm">
            <b>1. Introduction.</b> Welcome to Covert Control. By submitting a story, you agree to these Terms…
          </Text>
          <Text size="sm" mt="xs">
            <b>2. Your Content.</b> You retain ownership of your stories. You grant Covert Control a license to host and display…
          </Text>
          <Text size="sm" mt="xs">
            <b>3. Prohibited Conduct.</b> No illegal content, harassment, spam, or copyright infringement…
          </Text>
          <Text size="sm" mt="xs">
            <b>4. Termination.</b> We may suspend or terminate accounts that violate these Terms…
          </Text>
          <Text size="sm" mt="xs">
            <b>5. Disclaimers; Limitation of Liability.</b> Service is provided “as is”…
          </Text>
          <Text size="sm" mt="xs">
            <b>6. Changes.</b> We may update these Terms. Continued use after changes constitutes acceptance…
          </Text>
          <Text size="sm" mt="xs">
            <b>7. Contact.</b> For questions: support@covertcontrol.example
          </Text>
          <Text size="xs" c="dimmed" mt="md">
            Scroll to the bottom to enable acceptance.
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
            <Button
              onClick={handleAccept}
              disabled={!ackChecked || !canAcceptTerms || busy}
            >
              Accept & continue
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
