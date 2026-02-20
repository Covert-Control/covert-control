import { useState } from 'react';
import {
  Button,
  Checkbox,
  Container,
  Group,
  Paper,
  Space,
  Stack,
  Text,
  Title,
  List
} from '@mantine/core';

export function AgeGateScreen(props: {
  onAccept: (args: { remember: boolean }) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <Container size="sm" py={60}>
      <Paper withBorder radius="lg" p="xl">
        <Stack gap="md">
          <Title order={2}>Adults only (18+)</Title>

          <Text c="dimmed">
            This site may include adult and sexually explicit written content. By continuing,
            you confirm you are at least 18 years old.
          </Text>

          <Paper withBorder radius="md" px="xl" py="md">
            <Stack gap="xs">
              <Text size="sm" fw={700} c="dimmed">
                DISCLAIMER:
              </Text>

              <List spacing="xs" size="sm" c="dimmed" withPadding>
                <List.Item>
                  This site hosts fictional content with themes of hypnosis, mind control, and sexual non-consent.
                  These stories are purely fantasy and intended for adult entertainment only.
                </List.Item>

                <List.Item>
                  Covert Control does not endorse or promote any illegal or unethical behavior depicted in these stories.
                  In the real world, consent is always required. Reader discretion is advised.
                </List.Item>

                <List.Item>
                  All stories are user submitted. Covert Control does not review or moderate content prior to publication.
                  If you encounter any material that you believe violates our content guidelines, please report it to our moderation team for review.
                </List.Item>

                <List.Item>
                  Stories are under sole control of the authors and are not edited by Covert Control.
                  Stories should be properly tagged if there are particular themes you wish to avoid.
                </List.Item>

                <List.Item>
                  Thank you for respecting the boundaries of fiction and reality.
                </List.Item>
              </List>

              <Text size="sm" c="dimmed">
                — The Covert Control Team
              </Text>
            </Stack>
          </Paper>


          <Checkbox
            checked={confirmed}
            onChange={(e) => setConfirmed(e.currentTarget.checked)}
            label="I confirm that I am 18 years old or older."
          />

          <Checkbox
            checked={remember}
            onChange={(e) => setRemember(e.currentTarget.checked)}
            label="Remember me on this device"
          />

          <Group justify="space-between" mt="sm">
            <Button variant="default" component="a" href="https://www.google.com" rel="noreferrer">
              Leave
            </Button>

            <Button disabled={!confirmed} onClick={() => props.onAccept({ remember })}>
              Enter site
            </Button>
          </Group>

          <Space h={4} />
          <Text size="xs" c="dimmed">
            Tip: Creating an account will prevent you from being prompted by this screen in the future. 
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
}
