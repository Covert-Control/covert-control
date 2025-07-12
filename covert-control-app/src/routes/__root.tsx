import * as React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell, Burger, Group, Skeleton, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import SchemeToggleButton from '../components/SchemeToggleButton.tsx';
import DiscordButton from '../components/DiscordButton.tsx';
import Navbar from '../components/Navbar/Navbar.tsx';
import { useEffect } from 'react';
import { auth, db } from '../config/firebase.tsx';
import { SetUsernamePage } from '../components/SetUsernamePage.tsx';

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { user, isProfileComplete, loading, profileCheckedForUid, setAuthState, setLoading } = useAuthStore();
  

  // useEffect(() => {
  //   const auth = getAuth();
  //   setLoading(true);
    
  //   const unsubscribe = onAuthStateChanged(auth, (user) => {
  //     setUser(user || null);
  //   });

  //   return unsubscribe;
  // }, [setUser, setLoading]);

  useEffect(() => {
    // Set loading true initially or if a new auth check is definitely needed
    // This handles the initial app load state.
    if (user === null && profileCheckedForUid === null && !loading) {
        setLoading(true); // Only set loading true if we haven't checked for any user yet and are not already loading
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => { // Renamed param to currentUser to avoid conflict with store state
      if (currentUser) {
        const currentProfileCheckedForUid = useAuthStore.getState().profileCheckedForUid;
        const currentIsProfileComplete = useAuthStore.getState().isProfileComplete;
        // --- CACHING LOGIC ---
        // If the current user's profile completeness has already been checked
        // AND that user is the same as the one whose profile we previously checked
        // AND their profile was already found to be complete
        if (currentUser.uid === currentProfileCheckedForUid && currentIsProfileComplete === true) {
          useAuthStore.getState().setAuthState(currentUser, true, currentUser.uid); 
          console.log(`[__root.tsx] Profile for ${currentUser.uid} already confirmed complete. Skipping Firestore read.`);
          return; 
        }

        // --- END CACHING LOGIC ---
        // User is signed in, and we haven't confirmed their profile completeness yet (or it's a new user/incomplete profile)
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data()?.username_lc) {
            // User document exists AND has a username
            setAuthState(currentUser, true, currentUser.uid); // Profile is complete, cache this user's UID
            console.log(`[__root.tsx] Profile for ${currentUser.uid} confirmed complete via Firestore.`);
          } else {
            // User is logged in but profile is NOT complete (no username or doc missing)
            setAuthState(currentUser, false, null); // Profile is incomplete, do NOT cache UID as complete
            console.log(`[__root.tsx] Profile for ${currentUser.uid} found incomplete via Firestore.`);
          }
        } catch (error) {
          console.error("Error fetching user profile in __root.tsx:", error);
          setAuthState(currentUser, false, null); // Assume incomplete on error, do NOT cache UID as complete
        }
      } else {
        // User is signed out
        useAuthStore.getState().clearAuth(); // Clear state, including profileCheckedForUid
        console.log(`[__root.tsx] User signed out.`);
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []); 

  // Conditional Rendering based on authentication and profile state
  if (loading) {
    // Show a full-screen loading indicator while checking auth and profile
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

  if (user && isProfileComplete === false) { // Use 'user' from store
    // Force them to the SetUsernamePage. This page will take over the entire content area.
    return <SetUsernamePage />;
  }


  return (
    <React.Fragment>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 190, breakpoint: 'sm', collapsed: { mobile: !mobileOpened, desktop: !desktopOpened } }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            {/* Left-aligned items */}
            <Group>
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
              <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
              <p>Hello this is where logo go!!</p>
            </Group>

            {/* Right-aligned items */}
            <Group>
              <DiscordButton />
              <SchemeToggleButton />
              <div>
                {user === null ? 
                <Link to="/authentication">
                    <span>Login</span>
                </Link> :
                <a href="#" onClick={() => auth.signOut()}> 
                    <span>Logout</span>
                </a>
                }
              </div>
            </Group>
          </Group>
        </AppShell.Header>

        <Navbar />

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>

        <AppShell.Footer zIndex={mobileOpened ? 'auto' : 201}>
          This is the footer
        </AppShell.Footer>
      </AppShell>
    </React.Fragment>
  )
}
