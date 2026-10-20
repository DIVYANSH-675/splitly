# Validation — SplitBill 1.3.0 (in progress)

- Google-only welcome screen; backup-email and manual name/username signup removed.
- Verified Google profile initializes name/photo and a unique default handle up to eight characters. Users may edit these later; returning sign-in retains those edits.
- PKCE/state/API/redirect/expiry validation and server-side verified-provider checks are covered by local tests. Linked legacy identities retain group ownership, and a Google identity cannot be connected to two app users.
- Production registration/password/email routes are disabled. Historical database records are preserved.
- Local checks: 36 tests passed, TypeScript passed and ESLint passed. Browser inspection confirms the Google-only welcome screen and editable Profile with no backup-email section.
- Real Google OAuth provider configuration, browser sign-in, Android return flow and APK build are pending; no live Google sign-in success is claimed yet.

# Validation — SplitBill 1.2.1

- Source build: `71c450187d8e88dc47dbd5af3eb0d27b599cfe39`; [Android workflow 39383552995](https://github.com/DIVYANSH-675/splitly/actions/runs/39383552995).
- Transactions use one date section per recorded calendar day; bills and transfers for that day are shown together. Grouping tests cover mixed types, day ordering, stable legacy ordering, invalid/missing dates, and no mutation of ledger data. Browser checks confirm one 24 Oct 2026 heading above all four demo bills and a separate 20 Oct section for the transfer, with no repeated dates on cards.
- Updated bill and transfer forms have side-by-side From/To cards. Member selection uses a dedicated picker; bill splits support equal, exact amounts, shares and percentages. Done stays visible while the list scrolls.
- Browser checks at 320- and 390-pixel widths: cards fit side by side; selections and form values persist after Done; exact amounts/percentages validate; multiple payer amounts and rounding are preserved; transfer participants can be changed. No demo ledger entries were saved during these checks.
- Committed source passed 33 API/finance/offline tests, TypeScript and ESLint. Both Android CI jobs passed their source checks and native builds.
- Both standalone APKs passed ZIP integrity, Android v2 signature verification, package/version checks (`com.divyansh.splitly`, version 1.2.1, Android code 4), expected single ABI, hosted API and updated picker bundle-string checks. Signing certificate matches 1.2.0 for compatible in-place preview upgrades.
- ARM64: 36,843,242 bytes; SHA-256 `a60e5c2f6de0529ab849db181242c746cd24cbab9236fb7dd029bd053526e2da`.
- ARMv7: 27,863,830 bytes; SHA-256 `eb5a8fc43c3ca46ac8314e8b76398fb5014eb6ed9cd76c4d170c600ed2c018da`.
- Browser membership checks also passed: a synthetic Jigyasu Patel account claimed Jigyasu and kept the INR 600 balance; the member list showed the profile name and username; a group created through the comma-separated input became visible in the @username-invited account.
- Membership integration and live-cloud checks passed: @username users see groups without a manual join; unknown/duplicate usernames are rejected; claims rename the same member while preserving bills, transfers and balances; an existing linked account cannot be claimed; new joins start with a separate balance; author/admin edit restrictions are retained. Connected names follow profile updates. No database schema changes were required.
- The APKs contain the client at the build commit; subsequent release-documentation edits do not change the client.
- Physical-device installation and native camera/picker/share behavior remain unverified. Backup-email delivery still requires the SMTP setup documented in the README. Cloud schema was unchanged. The matching server update was deployed; only synthetic QA groups were created or changed during verification.

# Previous release — SplitBill 1.2.0

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
