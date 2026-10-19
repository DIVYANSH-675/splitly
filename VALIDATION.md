# Validation — SplitBill 1.2.0

## Completed

- Node API/finance/offline tests: 26 passing. Includes exact integer splits, transfers outside expense totals, creator/admin rights, full audit diffs, durable queue restart/concurrency/failure behavior, offline group/transfer/category projection, stable IDs, duplicate-safe writes/deletes, private attachment validation/access, persistent custom categories and unique usernames.
- Backup email: injected-provider integration test proves that an unverified email cannot recover an account; wrong/reused codes fail; another user cannot claim a linked email; successful email-code login restores the same user ID and group/admin rights. No real email or code is printed or included in source.
- Mobile TypeScript and ESLint passed after feature changes.
- Expo web and Android/Hermes exports passed. Android bundle was about 3.6 MB before final packaging; this is not the APK size.
- Dedicated free Supabase organization and project created under the requested developer account. Project `gomowueeizpwzzbqugod` is in Singapore. Eight private app tables were created through the dashboard; initial six-table RLS check returned true for every table. Backup email tables also enable RLS and revoke client privileges.
- Live cloud API smoke test passed: usernames, group join/access denial, shared category, private PDF upload, idempotent bill replay, peer edit denial, transfer excluded from spending, PDF and XLSX exports.
- Live exported PDF rendered and inspected: correct date/time, dynamic member shares, totals, settlements, transfers and graph. Notification history is absent. XLSX contains numeric financial data and audit details.
- Browser with the cloud API blocked: created a group, added a custom category, attached a PDF, saved a bill and transfer, reloaded. All four pending changes and the attachment remained. After unblocking, exactly one bill and transfer appeared; total was INR 240, each share INR 120, and payer balance INR +150 (including a separate INR 30 transfer).
- Full-page notifications and same-page analytics are implemented. Group invite QR is generated; camera scanning needs a device check.

## Delivery limits

- Backup-email code delivery requires a custom SMTP provider, confirmed sender, OTP email templates and `SPLITBILL_EMAIL_OTP_READY=true`. The free default service cannot customize the sign-in-link template. The server currently returns an explicit setup error instead of pretending to send a usable code. Real email delivery/recovery is not yet verified.
- Physical-device camera scanning, Android picker/share sheets, profile picker and a cold start without Internet still require device acceptance testing. Browser offline testing validates state/queue behavior, not those native integrations.
- Android APK build, final size and signing verification are recorded after the workflow finishes. Build/export success alone does not prove a physical-device install.
- Background sync/push, account recovery without a verified email, Play Store submission, production signing, SMTP provider and operational backups are not configured. Sync runs while the app is open.
- Existing local SQLite demo data is preserved and is not automatically uploaded to the cloud.
- Preview packages retain the Android identifier `com.divyansh.splitly` and legacy storage keys to preserve upgrades. The visible app name is SplitBill.
- Attachment data uses database quota. The API serves small groups with serialized database transactions; it is not load-tested at public-service scale.
