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
