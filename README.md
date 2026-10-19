# Splitly

A small Android app for shared trip expenses. Create a group, add bills, record transfers, and see who owes whom. Built with Expo / React Native and a Node.js + SQLite API.

## Get the Android app

Download **Splitly-1.1.0.apk** from [Releases](https://github.com/DIVYANSH-675/splitly/releases). This is a standalone preview APK; it does not need Expo Go. A physical-device acceptance test and Play Store release have not been completed.

The API must be running and reachable from your phone. On the welcome screen, open **Connection settings** and enter your server address. For a local computer use `http://YOUR_COMPUTER_LAN_IP:4310`, with your phone on the same Wi-Fi. A production installation should use a deployed HTTPS server. This repository does not provide hosted service or cloud backup.

## What it does

- Start with your name. No email/password required. Existing email accounts remain supported.
- Create groups with friends’ names or join using an invite code.
- Add bills with a category, payer, and an equal split by default. Unequal shares and multiple payers are available under **Split differently**.
- Record transfers between people. Transfers change balances and never increase trip expenses.
- See green **+** balances to receive, red **−** balances owed, and neutral zero balances.
- Open the notification bell for **who changed what**, with timestamps and before/after details. The home bell covers all your groups; the group bell covers that group.
- Edit/delete entries you created. The group creator is the admin and can edit/delete anyone’s bills and transfers. These rules are enforced by the API.
- Add bills offline in previously opened groups. Saved bills appear separately until the server accepts them.
- Export a group to **PDF** or **XLSX** under **Group options**. Reports include bills, payers, shares, balances, transfers, and available activity history.

Categories: Food & drinks, Travel, Stay, Activities, Groceries, Fuel, Shopping, Tickets, Rentals, Fees & tips, Health, Bills, Other.

There are no itineraries, feeds, maps, photo uploads, camera, subscriptions, or actual money transfers. The notification area is an activity inbox, not a chat feed.

## Run locally

Requires Node.js **22.13+** (CI uses 22.22.1).

```bash
npm ci
npm --prefix mobile ci
npm run dev
```

- Browser preview: `http://localhost:8081`
- API: `http://localhost:4310/api/health`
- Expo Go: scan the development server QR on the same network; SDK 58 support is required.
- `npm run dev:mobile` starts without the browser preview.
- Ctrl+C stops the launcher’s API and Expo processes.

To pin an API address, copy `mobile/.env.example` to `mobile/.env`, set `EXPO_PUBLIC_API_URL`, and restart Expo. An address saved through Connection settings takes precedence. Production EAS builds require HTTPS and disable cleartext traffic.

## Offline behavior

Open a group online at least once before going offline. The app caches the current identity and groups, then saves new bills to a durable device queue before trying the network. Queued bills can be edited, retried, or removed. Reconnection, app foregrounding, and periodic retries trigger sync while the app is open.

Confirmed totals exclude queued bills. A failed validation or permission check leaves the bill visible with its error. Network retries reuse the same request ID, so a lost response does not create a duplicate. If an uncertain bill has already synced, refresh and edit the confirmed entry instead of changing its queued copy.

Offline mode supports adding bills; creating/joining groups, changing confirmed entries, transfers, and exports require the API. Android’s installed bundle opens without the development server; the browser development preview itself is not a PWA and does not promise a cold start without its web server. Sync does not run while the app is closed.

Keep device app data until pending bills sync. Sign-out is blocked while bills remain queued. Clearing app data loses local drafts and a name-only identity; account recovery is not configured.

## Notifications and history

The activity inbox refreshes while the app is open and connected (up to about 15 seconds). Unread markers are stored on this device. No background push notification service is configured.

The API retains all new audit entries until the group is deleted. Historical entries saved by older versions are shown too, but details previously discarded by the old 300-entry limit cannot be reconstructed. New edits record the actual actor and old/new amounts, category, payer/share allocations, dates, notes, member names, or group settings.

## Exports

Open a group → **⋯ Group options** → **Export PDF** or **Export XLSX**. Android opens its share/save sheet; the browser downloads the file. Exports require a connection and group membership. Only confirmed server records are included, and the app flags queued bills that are excluded.

XLSX contains Summary, Balances, Expenses, Shares, Payers, Transfers, and Activity sheets. Monetary cells are numeric and use the group currency. PDF includes the same financial records and full available history. Exported reports are snapshots, not imports or editable app backups.

## Android APK build

The [Android APK workflow](.github/workflows/android.yml) is manually triggered from GitHub Actions. It installs pinned dependencies, runs tests/typecheck/lint, generates Android files with Expo prebuild, builds an ARM preview APK, and uploads `splitly-android-apk`. Generated Android/iOS directories are not committed.

Set the repository variable `EXPO_PUBLIC_API_URL` before building to choose the preview server. Otherwise the APK defaults to the Android emulator host (`http://10.0.2.2:4310`); a physical phone must change this under Connection settings.

The preview uses the generated Android debug signing key. Production signing, HTTPS hosting, backups, EAS credentials, and store submission need separate setup. `mobile/eas.json` also includes an internal APK profile for an EAS-enabled account.

## Verification

```bash
npm test
npm --prefix mobile run typecheck
npm --prefix mobile run lint
cd mobile
npx expo-doctor
npx expo export --platform android --platform web --max-workers 2
```

See [VALIDATION.md](VALIDATION.md) for completed checks and limitations. Tests cover integer rounding and splits, permissions, transfers, audit retention, offline queue durability/concurrency, idempotent sync, and PDF/XLSX financial reconciliation.

## Project map

```text
mobile/src/app/          Expo Router entry points
mobile/src/screens/      Welcome, home, group, profile
mobile/src/components/   Forms, activity inbox, pending bills, UI
mobile/src/lib/          API, cached state, offline queue, types
server/index.mjs        Authenticated HTTP API and SQLite storage
server/finance.mjs      Integer currency arithmetic and settlements
server/audit.mjs        Before/after audit snapshots
server/export.mjs       PDF and XLSX report generation
test/                   API, finance, export and offline tests
.github/workflows/      Android preview APK build
```

## Storage and deployment

SQLite defaults to `data/memogo.sqlite` for compatibility with earlier local versions. Set `SPLITLY_DB` to choose another path and `PORT` to change the API port. Back up the database using SQLite’s backup facilities. Devices store access tokens in native secure storage (browser preview uses local storage); cached group data and queued bills use app-local storage. The API authenticates every request and checks group membership.

The source repository excludes SQLite databases, device sessions, `.env` files, build caches, and credentials. The GitHub access token is not part of the application. Do not expose the local HTTP development API to the public Internet without HTTPS deployment and an appropriate operating/security review. Dependency audit findings and production limitations are recorded in VALIDATION.md.

## Design and attribution

Warm ivory, forest green, lime accents, bundled Manrope typography, and code-drawn receipt artwork. Motion respects the system reduced-motion setting. Manrope is distributed under the included [font license](server/assets/Manrope-LICENSE.txt).

Workflow inspiration: [Kittysplit](https://www.kittysplit.com/en/help) and the [Splitwise redesign](https://blog.splitwise.com/2019/07/09/splitwise-redesigned/). No third-party application artwork is included.
