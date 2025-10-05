import { getAuth, getIdTokenResult } from 'firebase/auth';

export async function isRecentLogin(thresholdSeconds = 5 * 60): Promise<boolean> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return false;

  // forceRefresh ensures a fresh token so auth_time is accurate
  const res = await getIdTokenResult(user, /* forceRefresh */ true);
  const authTimeSec = Math.floor(new Date(res.authTime).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  return (nowSec - authTimeSec) <= thresholdSeconds;
}