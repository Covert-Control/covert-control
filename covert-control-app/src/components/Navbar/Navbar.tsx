import * as React from 'react';
import { AppShell, ActionIcon, ScrollArea, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { LinksGroup } from '../NavbarLinksGroup/NavbarLinksGroup';
import { Link } from '@tanstack/react-router';
import { LogOut, LogIn, PencilLine, Library, House, ArrowLeft } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore'; // ✅ add
import classes from './Navbar.module.css';

interface NavItem {
  label: string;
  icon: React.FC<any>;
  link?: string;
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
}

const linkdata: NavItem[] = [
  { label: 'Home', icon: House, link: '/' },
  {
    label: 'Stories',
    icon: Library,
    initiallyOpened: false,
    links: [
      { label: 'All Stories', link: '/stories' },
      { label: 'Search Stories', link: '/advanced-search' },
      { label: 'Last Week\'s Stories', link: '/stories/weeklynew' },
      { label: 'Random', link: '/stories/random' },
      { label: 'Authors', link: '/authors' },
    ],
  },
  { label: 'Submit Story', icon: PencilLine, link: '/submit' },
];

export type SiteNavbarProps = {
  desktopOpened: boolean;
  onToggleDesktop: () => void;
};

export default function SiteNavbar({ desktopOpened, onToggleDesktop }: SiteNavbarProps) {
  const { clearAuth } = useAuthStore();
  const readerMode = useUiStore((s) => s.readerMode); // ✅ add
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`);

  const logOut = async () => {
    try {
      await signOut(auth);
      clearAuth();
    } catch (err) {
      console.error(err);
    }
  };

  const links = linkdata.map((item) => <LinksGroup {...item} key={item.label} />);

  return (
    <AppShell.Navbar p={0} zIndex={300}>
      {/* Hide the collapse arrow in reader mode */}
      {!readerMode && desktopOpened && isDesktop && (
        <ActionIcon
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          onClick={onToggleDesktop}
          variant="default"
          radius="xl"
          size="lg"
          className={classes.collapseButton}
        >
          <ArrowLeft size={18} />
        </ActionIcon>
      )}

      <nav className={classes.navbar}>
        <ScrollArea className={classes.links}>
          <div className={classes.linksInner}>{links}</div>
        </ScrollArea>

        <div className={classes.footer}>
          {auth.currentUser === null ? (
            <Link to="/authentication" className={classes.link}>
              <LogIn className={classes.linkIcon} />
              <span>Login</span>
            </Link>
          ) : (
            <button type="button" className={classes.link} onClick={logOut}>
              <LogOut className={classes.linkIcon} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </nav>
    </AppShell.Navbar>
  );
}
