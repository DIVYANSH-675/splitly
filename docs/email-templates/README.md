# Passwordless recovery email

Configure SMTP first. Use these bodies for both **Confirm sign up** (first backup verification) and **Magic link or OTP** (subsequent sign-in). Keep email confirmation enabled. Do not turn on `SPLITBILL_EMAIL_OTP_READY` before real delivery and recovery have been tested.

Subject: `Your SplitBill verification code`

```html
<h2>Your SplitBill code</h2>
<p>Enter this code in SplitBill:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>If you did not request this code, ignore this email. Do not share the code.</p>
```

Supabase Auth validates expiration and one-time use. The API additionally limits attempts and requires a matching pending challenge before linking a backup email. The old verified address remains valid until a replacement address is verified.
