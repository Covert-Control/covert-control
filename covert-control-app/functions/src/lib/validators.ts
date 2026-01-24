import { HttpsError } from 'firebase-functions/v2/https';

export const USERNAME_MIN_LEN = 3;
export const USERNAME_MAX_LEN = 30;

// Letters/numbers; underscores only between alnum runs.
// Rejected: "_user", "user_", "user__name", "____", "user-name", "user.name"
export const USERNAME_REGEX = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/;

export const RESERVED_USERNAMES = new Set<string>([
  'admin', 'administrator', 'kike', 'nigger', 'nigga', 'nazi', 'jiggaboo', 'jigaboo',
  'jailbait', 'lolita', 'pedophile', 'paedophile', 'underage'
]);

export const EMAIL_MAX_LEN = 320;

export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 1024;

// Small blocklist (UX + baseline). Backend is authoritative.
export const COMMON_PASSWORDS = new Set<string>([
  'password', 'password1', 'password123', 'password1234',
  '12345678', '123456789', 'qwerty123', 'letmein', 'iloveyou',
  'admin123', 'welcome123', 'abc12345',
]);

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${fieldName} must be a string.`);
  }
  return value;
}

export function normalizeEmail(raw: unknown): string {
  const email = requireString(raw, 'Email').trim();
  if (!email) throw new HttpsError('invalid-argument', 'Missing required field: email.');
  if (email.length > EMAIL_MAX_LEN) {
    throw new HttpsError('invalid-argument', `Email must be at most ${EMAIL_MAX_LEN} characters.`);
  }
  return email;
}

export function validatePassword(raw: unknown): string {
  const password = requireString(raw, 'Password');
  if (!password) throw new HttpsError('invalid-argument', 'Missing required field: password.');

  if (password.length < PASSWORD_MIN_LEN) {
    throw new HttpsError(
      'invalid-argument',
      `Password must be at least ${PASSWORD_MIN_LEN} characters long.`,
    );
  }
  if (password.length > PASSWORD_MAX_LEN) {
    throw new HttpsError(
      'invalid-argument',
      `Password must be at most ${PASSWORD_MAX_LEN} characters long.`,
    );
  }

  // Block very common passwords (case-insensitive)
  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    throw new HttpsError('invalid-argument', 'That password is too common. Please choose a more unique password.');
  }

  return password;
}

export function validateUsername(raw: unknown): { username: string; username_lc: string } {
  const usernameRaw = requireString(raw, 'Username');
  const username = usernameRaw.trim();
  const username_lc = username.toLowerCase();

  if (!username) {
    throw new HttpsError('invalid-argument', 'Username cannot be empty or just whitespace.');
  }

  if (/[\r\n\t]/.test(username)) {
    throw new HttpsError('invalid-argument', 'Username cannot contain tabs or newlines.');
  }

  if (username.length < USERNAME_MIN_LEN || username.length > USERNAME_MAX_LEN) {
    throw new HttpsError(
      'invalid-argument',
      `Username must be between ${USERNAME_MIN_LEN} and ${USERNAME_MAX_LEN} characters.`,
    );
  }

  if (!USERNAME_REGEX.test(username)) {
    throw new HttpsError(
      'invalid-argument',
      'Username may contain only letters, numbers, and single underscores (no leading/trailing or double underscores).',
    );
  }

  if (RESERVED_USERNAMES.has(username_lc)) {
    throw new HttpsError('invalid-argument', 'That username is reserved. Please choose a different one.');
  }

  return { username, username_lc };
}
