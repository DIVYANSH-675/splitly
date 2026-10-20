import { assert } from './finance.mjs';

// Google credentials stay in Supabase. The app sends only a one-use PKCE code.
export function createGoogleAuth({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY, request = fetch } = {}) {
  const call = async (path, options = {}) => {
    assert(url && key, 'Google sign-in needs the SplitBill cloud connection.', 503);
    const response = await request(`${url}/auth/v1/${path}`, {
      ...options,
      headers: { apikey: key, 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    assert(response.ok, response.status === 429
      ? 'Too many sign-in attempts. Try again later.'
      : 'Google sign-in could not be verified. Please start again.', response.status === 429 ? 429 : 401);
    return data;
  };
  return {
    config: async () => {
      const settings = await call('settings');
      assert(settings.external?.google, 'Google sign-in is not configured yet. Please try again after setup is complete.', 503);
      return { authorizeUrl: `${url}/auth/v1/authorize` };
    },
    exchange: async (code, verifier) => {
      assert(typeof code === 'string' && code.length > 0 && code.length <= 2048, 'Start Google sign-in again');
      assert(typeof verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(verifier), 'Start Google sign-in again');
      const session = await call('token?grant_type=pkce', {
        method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      });
      assert(session.access_token, 'Google sign-in could not be verified', 401);
      const user = await call('user', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const identity = user.identities?.find(item => item.provider === 'google');
      const details = identity?.identity_data;
      assert(details?.sub && details.email_verified === true && user.email_confirmed_at,
        'Use a verified Google account to continue', 401);
      const email = String(details.email || '').trim().toLowerCase();
      assert(email === user.email?.toLowerCase() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Google email could not be verified', 401);
      // Identity metadata supplies presentation only, never roles or app ownership.
      let photo = '';
      try {
        const avatar = new URL(details.picture || details.avatar_url || '');
        if (avatar.protocol === 'https:' && (avatar.hostname === 'googleusercontent.com' || avatar.hostname.endsWith('.googleusercontent.com')) && !avatar.username && !avatar.password && avatar.href.length < 2048) photo = avatar.href;
      } catch { /* Google accounts without a photo use initials. */ }
      return { photo, subject: String(details.sub), email, name: String(details.full_name || details.name || 'Friend').trim().slice(0, 60) || 'Friend' };
    },
  };
}
