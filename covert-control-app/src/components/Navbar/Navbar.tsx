// components/Navbar/Navbar.tsx
import { AppShell, ActionIcon, ScrollArea } from '@mantine/core';
import { LinksGroup } from '../NavbarLinksGroup/NavbarLinksGroup';
import { Link } from '@tanstack/react-router';
import { LogOut, LogIn, PencilLine, Library, House, ArrowLeft } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
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
      { label: 'Most Recent', link: '/stories' },
      { label: 'Advanced Search', link: '/advanced-search' },
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
  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const links = linkdata.map((item) => <LinksGroup {...item} key={item.label} />);

  // IMPORTANT: return exactly ONE AppShell.Navbar element. No fragments, no siblings.
  return (
    <AppShell.Navbar>

      {desktopOpened && (
        <ActionIcon
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          onClick={onToggleDesktop}
          variant="default"
          radius="xl"
          size="lg"
          style={{
            position: 'absolute',
            top: 8,
            right: -18, // 36px button -> half outside so it “straddles” the edge
            zIndex: 2,
          }}
        >
          <ArrowLeft size={18} />
        </ActionIcon>
      )}

      {/* Your actual nav content */}
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
            <a href="#" className={classes.link} onClick={logOut}>
              <LogOut className={classes.linkIcon} />
              <span>Logout</span>
            </a>
          )}
        </div>
      </nav>
    </AppShell.Navbar>
  );
}
