# Validation — SplitBill 1.2.0

## Completed

- Node API/finance/offline tests: 29 passing. Includes exact integer splits, transfers outside expense totals, creator/admin rights, full audit diffs, durable queue restart/concurrency/failure behavior, offline group/transfer/category projection, stable IDs, duplicate-safe writes/deletes, private attachment validation/access, persistent custom categories and unique usernames. Caller-generated IDs cannot overwrite another group, duplicate entry IDs are rejected, and request replay rechecks current membership.
- Backup email: injected-provider integration test proves that an unverified email cannot recover an account; wrong/reused codes fail; another user cannot claim a linked email; successful email-code login restores the same user ID and group/admin rights. No real email or code is printed or included in source.
- Mobile TypeScript and ESLint passed after feature changes.
- Expo web and Android/Hermes exports passed. Android bundle was about 3.6 MB before final packaging; this is not the APK size.
- Dedicated free Supabase organization and project created under the requested developer account. Project `gomowueeizpwzzbqugod` is in Singapore. Eight private app tables were created through the dashboard; the final eight-table check returned RLS=true and anonymous SELECT=false for every table.
- Live cloud API smoke test passed: usernames, group join/access denial, shared category, private PDF upload, idempotent bill replay, peer edit denial, transfer excluded from spending, PDF and XLSX exports.
- Supabase Security Advisor reported zero errors and zero warnings. After the restricted server-role migration, rerunning Security Advisor reported zero errors, zero warnings and zero informational notices. Runtime role checks confirmed it cannot read Supabase Auth users or create schema objects; full live CRUD/export checks passed under that role.
- Live exported PDF rendered and inspected: correct date/time, dynamic member shares, totals, settlements, transfers and graph. Notification history is absent. XLSX contains numeric financial data and audit details.
- Browser with the cloud API blocked: created a group, added a custom category, attached a PDF, saved a bill and transfer, reloaded. All four pending changes and the attachment remained. After unblocking, exactly one bill and transfer appeared; total was INR 240, each share INR 120, and payer balance INR +150 (including a separate INR 30 transfer).
- Browser profile photo selection, resize, save and reload passed; the test photo was then removed. Full-page notifications and same-page analytics passed visual/DOM checks. Group invite QR is generated; camera scanning needs a device check.

## Delivery limits

- Backup-email code delivery requires a custom SMTP provider, confirmed sender, OTP email templates and `SPLITBILL_EMAIL_OTP_READY=true`. The free default service cannot customize the sign-in-link template. The server currently returns an explicit setup error instead of pretending to send a usable code. Real email delivery/recovery is not yet verified.
- Physical-device camera scanning, Android picker/share sheets, profile picker and a cold start without Internet still require device acceptance testing. Browser offline testing validates state/queue behavior, not those native integrations.
- Android workflow [39323964316](https://github.com/DIVYANSH-675/splitly/actions/runs/39323964316) built both APKs from client commit `2eec97d`. Later commits change server code, migrations and documentation; mobile source is identical.
- ARM64 APK: 36,835,382 bytes (35.13 MiB), SHA-256 `c728203183230961cbe752529f9b4656ba0809f43967a87402195f8deccc621f`.
- ARMv7 APK: 27,855,970 bytes (26.57 MiB), SHA-256 `0599f38a40f1307473ecd76cbf456902906823e10765dfc4d2ddec8789624b9c`.
- Both passed APK ZIP integrity, Android v2 signature verification, package/version checks (`com.divyansh.splitly`, 1.2.0, code 3), Android 7+ minimum, expected single ABI, visible SplitBill name and embedded hosted API checks. No microphone or broad photo/storage permission is declared. Signing uses the same preview debug certificate on both.
- Physical-device installation and native hardware behavior remain unverified.
- Background sync/push, account recovery without a verified email, Play Store submission, production signing, SMTP provider and operational backups are not configured. Sync runs while the app is open.
- Existing local SQLite data is preserved. All five existing groups, five user identities and six hashed sessions were migrated to the private cloud database. The live browser preview was switched to the cloud API; subsequent local-only SQLite edits remain separate.
- Preview packages retain the Android identifier `com.divyansh.splitly` and legacy storage keys to preserve upgrades. The visible app name is SplitBill.
- Attachment data uses database quota. The API serves small groups with serialized database transactions; it is not load-tested at public-service scale.
