import DiscordLogo from '../assets/discordwhiteicon.png';
import { ActionIcon } from '@mantine/core';

export default function DiscordButton() {
  return (
    <a href="google.com">
        <ActionIcon 
            variant="filled" 
            aria-label="Join Discord" 
            title="Join us on Discord!"
        >
            <img src={DiscordLogo} width="18" height="18" />
        </ActionIcon>
    </a>
  );
}