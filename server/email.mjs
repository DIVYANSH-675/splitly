import { assert } from './finance.mjs';
export function createEmailAuth() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const request = async (path, body) => {
    assert(
      process.env.SPLITBILL_EMAIL_OTP_READY === 'true',
      'Backup email needs email delivery setup. Configure SMTP and code templates in Supabase first.',
      503,
    );
    assert(
      url && key,
      'Backup email needs the hosted service. Select the SplitBill cloud connection.',
      503,
    );
    const response = await fetch(`${url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = String(
        data.msg || data.error_description || data.message || 'Email request failed',
      );
      assert(
        false,
        /email.*not.*authorized|email address.*not authorized/i.test(error)
          ? 'Email delivery needs SMTP setup for addresses outside the project team.'
          : response.status === 429
            ? 'Too many email requests. Wait before trying again.'
            : /expired|invalid|token/i.test(error)
              ? 'This code is incorrect or expired. Request a new code.'
              : 'Email service could not complete this request. Please try again later.',
        response.status === 429 ? 429 : 400,
      );
    }
    return data;
  };
  return {
    send: (email, create) => request('otp', { email, create_user: create }),
    verify: async (email, code) => {
      const data = await request('verify', { email, token: code, type: 'email' });
      assert(
        data.user?.email?.toLowerCase() === email && data.user?.email_confirmed_at,
        'Verify your email to continue',
        401,
      );
      return data.user;
    },
  };
}
