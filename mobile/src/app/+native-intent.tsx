import { redirectGoogleSystemPath } from '../lib/google';

// The WebBrowser listener still receives the URL. Avoid opening a second screen
// for the same warm return; cold returns continue to /auth/google for recovery.
export const redirectSystemPath = redirectGoogleSystemPath;
