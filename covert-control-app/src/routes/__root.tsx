// __root.tsx
import * as React from 'react';
import { AppShell, Burger, Group, Skeleton, Title, Alert, Button, Text, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import SiteNavbar from '../components/Navbar/Navbar.tsx'; // ⬅️ renamed import
import { AccountDropDown } from '../components/AccountDropDown.tsx';
import { useAuthStore } from '../stores/authStore';
import { SetUsernamePage } from '../components/SetUsernamePage.tsx';
import { useAuthListener } from '../hooks/useAuthListener';
import SiteLogo from '../assets/logo.png';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../config/firebase.tsx';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useAuthListener();

  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const { user, isProfileComplete, loading, isEmailVerified, email } = useAuthStore();

  const handleResendVerification = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        // we could show a tiny in-app feedback; simplest is alert() or console for now
        // You could also use notifications.show(...) if you want consistency
        console.log('Verification email re-sent');
      } catch (err) {
        console.error('Error resending verification email:', err);
      }
    }
  };

  if (loading) {
    return (
      <AppShell header={{ height: 60 }} padding="md">
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Title order={1}>Loading App...</Title>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <Skeleton height={200} mb="xl" />
          <Skeleton height={100} mb="xl" />
          <Skeleton height={300} />
        </AppShell.Main>
      </AppShell>
    );
  }

  if (user && isProfileComplete === false) {
    return <SetUsernamePage />;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 190,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {/* Mobile burger (only shows < sm) */}

              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
                aria-label={mobileOpened ? 'Close sidebar' : 'Open sidebar'}
                title={mobileOpened ? 'Close sidebar' : 'Open sidebar'}
              />


              <Burger
                opened={desktopOpened}
                onClick={toggleDesktop}
                visibleFrom="sm"
                size="sm"
                aria-label={desktopOpened ? 'Collapse sidebar' : 'Expand sidebar'}
                title={desktopOpened ? 'Collapse sidebar' : 'Expand sidebar'}
              />

            <img src={SiteLogo} width="50" height="50" />
          </Group>
          <Group>
            <DiscordButton />
            <SchemeToggleButton />
            <AccountDropDown />
          </Group>
        </Group>
      </AppShell.Header>

      {/* IMPORTANT: Only AppShell slot children go here */}
      <SiteNavbar desktopOpened={desktopOpened} onToggleDesktop={toggleDesktop} />

      <AppShell.Main>

        {/* ⬇⬇ UNVERIFIED EMAIL BANNER ⬇⬇ */}
      {user &&
        !isEmailVerified &&           // <-- CHANGED
        !bannerDismissed && (
          <Alert
            color="yellow"
            variant="light"
            radius="md"
            mb="md"
            style={{
              border: '1px solid rgba(255, 255, 0, 0.3)',
            }}
          >
            <Stack gap="xs">
              <Text fw={500}>
                Please verify your email to unlock full features.
              </Text>

              <Text size="sm" c="dimmed">
                You must verify your email to submit and like stories.
                We sent a link to <b>{email ?? 'your email address'}</b>. Didn’t see it?
              </Text>

              <Group justify="space-between" wrap="wrap">
                <Button
                  size="xs"
                  radius="sm"
                  onClick={handleResendVerification}
                  variant="default"
                >
                  Resend verification email
                </Button>

                <Button
                  size="xs"
                  radius="sm"
                  color="gray"
                  variant="subtle"
                  onClick={() => setBannerDismissed(true)}
                >
                  Dismiss
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}


        {/* Main page content */}
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer zIndex={mobileOpened ? 'auto' : 201}>
        This is the footer
      </AppShell.Footer>
    </AppShell>
  );
}
