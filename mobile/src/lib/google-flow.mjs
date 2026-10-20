// Kept pure so callback/state validation is shared by web and native and tested.
export function googleAuthorizeUrl(authorizeUrl, redirect, state, challenge) {
  const callback = new URL(redirect);
  callback.searchParams.set('state', state);
  const url = new URL(authorizeUrl);
  url.searchParams.set('provider', 'google');
  url.searchParams.set('redirect_to', callback.toString());
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 's256');
  url.searchParams.set('scopes', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}
export function googleCallback(url, pending, apiUrl, now = Date.now()) {
  if (!pending || pending.apiUrl !== apiUrl || now-pending.createdAt > 600000 || now < pending.createdAt)
    throw new Error('This sign-in expired. Please start Google sign-in again.');
  const callback = new URL(url);
  const expected = new URL(pending.redirect);
  if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname || callback.searchParams.get('state') !== pending.state)
    throw new Error('This sign-in could not be matched to your device. Please start again.');
  if (callback.searchParams.has('error')) throw new Error('Google sign-in was cancelled or declined. Please try again.');
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Google did not return a sign-in code. Please try again.');
  return {code,verifier:pending.verifier};
}
