import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { admin } from './lib/admin'; 

const ABOUT_MAX = 1000;
const CONTACT_EMAIL_MAX = 320;
const DISCORD_MAX = 64;
const PATREON_MAX = 128;
const OTHER_MAX = 200;

function hasBadControlChars(s: string) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);

    // allow newline (10) and carriage return (13) for About Me
    if ((c < 32 || c === 127) && c !== 10 && c !== 13) {
      return true;
    }
  }
  return false;
}

function isValidEmail(s: string) {
  return /^\S+@\S+\.\S+$/.test(s);
}

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getString(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  if (typeof v !== 'string') {
    throw new HttpsError('invalid-argument', `${key} must be a string.`);
  }
  return v;
}

function validateOptionalString(name: string, vRaw: string, maxLen: number): string {
  const v = (vRaw ?? '').trim();
  if (!v) return ''; // allow clearing
  if (v.length > maxLen) throw new HttpsError('invalid-argument', `${name} must be ${maxLen} characters or fewer.`);
  if (hasBadControlChars(v)) throw new HttpsError('invalid-argument', `${name} contains invalid characters.`);
  return v;
}

function validateAboutMe(vRaw: string): string {
  const v = vRaw ?? '';
  // allow newlines; trim at edges
  const trimmed = v.trim();
  if (!trimmed) return '';
  if (trimmed.length > ABOUT_MAX) throw new HttpsError('invalid-argument', `About Me must be ${ABOUT_MAX} characters or fewer.`);
  if (hasBadControlChars(trimmed)) throw new HttpsError('invalid-argument', 'About Me contains invalid characters.');
  return trimmed;
}

function validateContactEmail(vRaw: string): string {
  const v = (vRaw ?? '').trim();
  if (!v) return '';
  if (v.length > CONTACT_EMAIL_MAX) throw new HttpsError('invalid-argument', `Contact email must be ${CONTACT_EMAIL_MAX} characters or fewer.`);
  if (hasBadControlChars(v)) throw new HttpsError('invalid-argument', 'Contact email contains invalid characters.');
  if (!isValidEmail(v)) throw new HttpsError('invalid-argument', 'Please enter a valid contact email address, or leave this blank.');
  return v.toLowerCase();
}

function validateDiscord(vRaw: string): string {
  const v = validateOptionalString('Discord', vRaw, DISCORD_MAX);
  if (!v) return '';

  if (/\s/.test(v)) throw new HttpsError('invalid-argument', 'Discord cannot contain spaces.');

  const handleOk = /^@?[A-Za-z0-9._]{2,32}(?:#[0-9]{4})?$/.test(v);
  let urlOk = false;

  if (isHttpUrl(v)) {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    urlOk =
      host === 'discord.gg' ||
      host.endsWith('.discord.gg') ||
      host === 'discord.com' ||
      host === 'www.discord.com';
  }

  if (!handleOk && !urlOk) {
    throw new HttpsError('invalid-argument', 'Enter a Discord handle (e.g., @name) or a Discord link (https://discord.gg/...).');
  }

  return v;
}

function validatePatreon(vRaw: string): string {
  const v = validateOptionalString('Patreon', vRaw, PATREON_MAX);
  if (!v) return '';

  const slugOk = /^[A-Za-z0-9_-]{1,64}$/.test(v);
  let urlOk = false;

  if (isHttpUrl(v)) {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    urlOk = host === 'patreon.com' || host === 'www.patreon.com';
  }

  if (!slugOk && !urlOk) {
    throw new HttpsError('invalid-argument', 'Enter a Patreon link (https://patreon.com/...) or a creator handle (letters/numbers/_/-).');
  }

  return v;
}

function validateOther(vRaw: string): string {
  const v = validateOptionalString('Other', vRaw, OTHER_MAX);
  if (!v) return '';

  if (v.includes('://') && !isHttpUrl(v)) {
    throw new HttpsError('invalid-argument', 'Other links must start with http:// or https://');
  }

  return v;
}

export const updatePublicProfile = onCall(async (req: CallableRequest) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to update your profile.');
  }

  const data = (req.data ?? {}) as Record<string, unknown>;

  // Require keys to be present as strings (client always sends them); allow empty to clear.
  const aboutMeRaw = getString(data, 'aboutMe');
  const contactEmailRaw = getString(data, 'contactEmail');
  const discordRaw = getString(data, 'discord');
  const patreonRaw = getString(data, 'patreon');
  const otherRaw = getString(data, 'other');

  const aboutMe = validateAboutMe(aboutMeRaw);
  const contactEmail = validateContactEmail(contactEmailRaw);
  const discord = validateDiscord(discordRaw);
  const patreon = validatePatreon(patreonRaw);
  const other = validateOther(otherRaw);

  const uid = req.auth.uid;

  const patch = {
    aboutMe,
    contactEmail,
    discord,
    patreon,
    other,
    profileUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await admin.firestore().doc(`users/${uid}`).set(patch, { merge: true });

    logger.log(`Public profile updated for uid=${uid}`);

    return {
      profile: {
        aboutMe,
        contactEmail,
        discord,
        patreon,
        other,
      },
    };
  } catch (err: unknown) {
    logger.error('updatePublicProfile failed:', err);
    throw new HttpsError('internal', 'Unable to update profile right now. Please try again.');
  }
});
