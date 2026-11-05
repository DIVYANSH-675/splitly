# SplitBill 1.3.3 — Local access and reviewer demo

- Add a neutral age screen for ages 9–12, 13–15, 16–17 and 18+.
- Give ages 9–17 a separate persistent on-device ledger, set up by a parent with a six-digit PIN. The parent birth date is checked locally and discarded; the PIN is stored as a salted hash with failed-attempt lockout.
- Keep younger-user ledgers separate from Google/cloud accounts. Online invitations, camera, profile photos, receipts and external report sharing are unavailable in this mode.
- Let adults explore, edit, reset and exit a synthetic sample ledger without an account. Demo PDF/XLSX exports are generated locally.
- Disable Android cloud backup and device transfer of app data. Clearing data or uninstalling loses local-only ledgers.

Build 11 is being prepared for testing. Public release still requires completed app-content declarations, closed testing and Google approval. Native parent setup, SDK traffic, installation and OAuth return require physical-device acceptance.

# SplitBill 1.3.2 — Google sign-in return

- Fix competing Google return handlers that could reopen the sign-in flow.
- Keep Android sign-in in the app task, avoiding a separate browser task in Back navigation.
- Recover delayed callbacks and sign-ins interrupted by an app restart.
- Show progress while completing sign-in and retain successful authentication if loading groups temporarily fails.

43 tests, TypeScript, lint and signed-bundle checks pass. Build 10 is active in Google Play internal testing. Allow time for Play propagation; physical-phone sign-in and Back navigation remain unverified.

# SplitBill 1.3.1 — Google Play internal testing

- Choose an expense date when adding a bill, or correct the date while editing it.
- Use the native calendar picker on Android/iOS and a date field on web.
- Preserve selected dates in offline queues and group transactions under the corrected day.
- Configure production Android App Bundle builds under the developerg Expo account.

Build 9 is published to Google Play internal testing with the developerg account as the initial tester. Public production access still requires Play app-information/review requirements and the mandatory closed test. Privacy and deletion-support pages are live, and Google OAuth is in production. Physical-device acceptance remains unverified.

# SplitBill 1.3.0 preview

- Sign in with Google and start with your Google name and profile photo.
- Receive a unique default username of up to eight characters; edit your name, username and photo in Profile.
- Connect an existing signed-in account to Google to keep its groups when signing in on another device.
- Select payers and participants using side-by-side From and To controls.
- Join as a new member or claim an unclaimed guest name while preserving its bills and balance.
- Group transactions under one date heading per day.
- Keep attachments, custom categories, transfers, offline queues, analytics and PDF/XLSX ledgers.

Google sign-in and sign-out/sign-in passed in the browser against the live backend. Android APK integrity, version and signatures are verified; physical-device OAuth return behavior still needs testing. See [validation](../VALIDATION.md) for the checks and limitations.

Download version 1.3.0 from [GitHub Releases](https://github.com/DIVYANSH-675/splitly/releases/tag/v1.3.0). Install over the previous preview without clearing app data.

## Previous changes: 1.2.0

- Rename the app to SplitBill while retaining the Android package and existing device storage.
- Add private optional bill attachments, group-wide custom categories and a resized profile photo.
- Add unique usernames, QR group joining, category analytics and full-page notifications.
- Extend durable offline saving to transfers and group/member/profile edits.
- Host the authenticated API and private database in the dedicated Supabase project.
- Replace PDF history with a financial ledger, individual share columns and optional graphs.
- Build smaller separate ARM64 and ARMv7 preview APKs with release shrinking enabled.

Preview signing uses generated debug credentials. Store submission and physical-device acceptance remain separate.
