// __root.tsx
import * as React from 'react';
import { AppShell, Burger, Group, Alert, Button, Text, Stack, Box, Loader, Center } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, createRootRoute, useMatchRoute, Link, useRouterState } from '@tanstack/react-router';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import SiteNavbar from '../components/Navbar/Navbar.tsx'; 
import { AccountDropDown } from '../components/AccountDropDown.tsx';
import { useAuthStore } from '../stores/authStore';
import { SetUsernamePage } from '../components/SetUsernamePage.tsx';
import { useAuthListener } from '../hooks/useAuthListener';
import SiteLogo from '../assets/logo.png';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../config/firebase.tsx';
import { AdminMailbox } from '../components/AdminMailbox';
import { useUiStore } from '../stores/uiStore';
import { AuthBootListener } from '../components/useAuthBootListener.tsx';
import SiteFooter from '../components/SiteFooter';
import { useAgeGate } from '../hooks/useAgeGate';
import { AgeGateScreen } from '../components/AgeGateScreen';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useAuthListener();

  const [mobileOpened, mobileHandlers] = useDisclosure();
  const { toggle: toggleMobile, close: closeMobile } = mobileHandlers;

  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const { user, isProfileComplete, loading, isEmailVerified, email } = useAuthStore();

  // ✅ Age gate (Zustand-backed hook)
  const uid = user?.uid ?? null;
  const { isReady: ageReady, accepted: ageAccepted, accept: acceptAgeGate } = useAgeGate(uid);

  const VERIFICATION_COOLDOWN_MS = 60_000;

  const cooldownKey = React.useMemo(() => {
    return user?.uid ? `cc:verify-cooldown:${user.uid}` : `cc:verify-cooldown:anonymous`;
  }, [user?.uid]);

  const [cooldownUntil, setCooldownUntil] = React.useState<number>(0);
  const [resendLoading, setResendLoading] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  const matchRoute = useMatchRoute();
  const isStoryReaderRoute = !!matchRoute({ to: '/stories/$storyId', fuzzy: true });

  const readerMode = useUiStore((s) => s.readerMode);
  const effectiveReaderMode = isStoryReaderRoute && readerMode;

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  React.useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(cooldownKey);
      const parsed = raw ? Number(raw) : 0;
      setCooldownUntil(Number.isFinite(parsed) ? parsed : 0);
    } catch {
      setCooldownUntil(0);
    }
  }, [cooldownKey]);

  React.useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const isCoolingDown = secondsLeft > 0;

  const handleResendVerification = async () => {
    if (resendLoading || isCoolingDown) return;
    if (!auth.currentUser) return;

    setResendLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);

      const until = Date.now() + VERIFICATION_COOLDOWN_MS;
      setCooldownUntil(until);

      try {
        localStorage.setItem(cooldownKey, String(until));
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Error resending verification email:', err);
    } finally {
      setResendLoading(false);
    }
  };

  const Boot = <AuthBootListener />;

  // 1) Auth boot/loading (don’t render site content yet)
  if (loading) {
    return (
      <>
        {Boot}
        <Center h="100vh">
          <Loader />
        </Center>
      </>
    );
  }

  // 2) Force profile completion before anything else
  if (user && isProfileComplete === false) {
    return (
      <>
        {Boot}
        <SetUsernamePage />
      </>
    );
  }

  // 3) Age gate (site-wide)
  if (!ageReady) {
    return (
      <>
        {Boot}
        <Center h="100vh">
          <Loader />
        </Center>
      </>
    );
  }

  if (!ageAccepted) {
    return (
      <>
        {Boot}
        <AgeGateScreen onAccept={acceptAgeGate} />
      </>
    );
  }

  // 4) ✅ Normal app shell
  return (
    <>
      {Boot}
      <AppShell
        header={{ height: 60, collapsed: effectiveReaderMode }}
        navbar={{
          width: 190,
          breakpoint: 'sm',
          collapsed: {
            mobile: effectiveReaderMode ? true : !mobileOpened,
            desktop: effectiveReaderMode ? true : !desktopOpened,
          },
        }}
        footer={{ height: 40, collapsed: effectiveReaderMode }}
        padding={effectiveReaderMode ? 0 : 'md'}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
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

              <Box
                component={Link}
                to="/"
                onClick={() => {
                  if (mobileOpened) closeMobile();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 0,
                  textDecoration: 'none',
                }}
                aria-label="Go to home"
              >
                <img
                  src={SiteLogo}
                  alt="Covert Control"
                  style={{ height: 28, width: 'auto', display: 'block' }}
                />
              </Box>
            </Group>

            <Group>
              <AdminMailbox />
              <DiscordButton />
              <SchemeToggleButton />
              <AccountDropDown />
            </Group>
          </Group>
        </AppShell.Header>

        <SiteNavbar desktopOpened={desktopOpened} onToggleDesktop={toggleDesktop} />

        <AppShell.Main style={effectiveReaderMode ? { padding: 0 } : undefined}>
          {!effectiveReaderMode && user && !isEmailVerified && !bannerDismissed && (
            <Alert
              color="yellow"
              variant="light"
              radius="md"
              mb="md"
              style={{ border: '1px solid rgba(255, 255, 0, 0.3)' }}
            >
              <Stack gap="xs">
                <Text fw={500}>Please verify your email to unlock full features.</Text>

                <Text size="sm" c="dimmed">
                  You must verify your email to submit and like stories. We sent a link to{' '}
                  <b>{email ?? 'your email address'}</b>. Didn’t see it?
                </Text>

                <Group justify="space-between" wrap="wrap">
                  <Button
                    size="xs"
                    radius="sm"
                    onClick={handleResendVerification}
                    variant="default"
                    loading={resendLoading}
                    disabled={resendLoading || isCoolingDown}
                  >
                    {isCoolingDown ? `Resend available in ${secondsLeft}s` : 'Resend verification email'}
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

          <Outlet />
        </AppShell.Main>

        <AppShell.Footer zIndex={mobileOpened ? 'auto' : 201} p={0}>
          {!effectiveReaderMode && <SiteFooter />}
        </AppShell.Footer>
      </AppShell>
    </>
  );
}
