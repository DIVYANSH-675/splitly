# Splitly verification — 20 October 2026

This replaces the earlier MemoGo recreation verification record and includes the Splitly visual redesign.

## Checks completed

- 13 automated tests pass.
- TypeScript check and Expo lint pass.
- Expo Doctor: 20/20 checks pass.
- Android/Hermes and web JavaScript/assets exports pass. These are not signed APK builds.
- The updated API and Expo development server start successfully and retain existing financial data and sign-in sessions.

Automated coverage includes integer split arithmetic, equal/exact/percentage/weighted splits, multiple payers, rounding conservation, settlements, authentication and membership boundaries, device identities created using a name alone, invite-code guest claiming, edits/deletions, and SQLite persistence after restarting the server.

Regression checks verify that itineraries, feed posts, and place-search endpoints are unavailable; new photo attachments are rejected; group creation needs no travel dates; removed feature fields and receipt images are not returned; and legacy data remains on disk when an old bill is edited.

## Browser checks

At a 412 × 915 phone-sized viewport:

- The app and browser title display Splitly.
- The home screen has New group, Join group, a simple group list, and two navigation items: Groups and Profile.
- An existing four-person demo group retained four bills, ₹14,000 total spend, and its existing payment history and ₹1,400 balance.
- A new session started with only the name Sam (demo), without entering email/password.
- Created Dinner · Demo by entering only a group name and two friends.
- Added a ₹900 dinner using amount, description and default payer. The app showed a ₹300 share for each of three people and ₹600 owed back to its payer.
- Balances showed two ₹300 repayment suggestions.
- The normal bill form has no image upload, camera, date, currency-conversion, or itinerary controls. It now includes a compact category picker. Additional split methods are hidden behind Split differently.

## Visual redesign verification

- Reworked welcome, home, group, bill entry, settlement, profile, and shared dialogs using one ivory/forest/lime palette and bundled Manrope fonts. Updated app icons match the split mark.
- Checked the existing group at 320 × 700 and 412 × 915. The complete group overview scrolls on short screens and the Add a bill action remains fixed.
- The existing demo still shows four bills, ₹14,000 total spend and ₹1,400 owed back to Alex.
- In a separate local session, started as Design QA, created UI review · Demo with Lee and Noor, and saved a ₹900 Coffee bill. The new form preview showed ₹300 each; the saved summary showed ₹600 owed back, and Settle up showed two ₹300 repayment suggestions. Opened and dismissed the repayment sheet without recording a payment.
- No browser warnings or errors were reported for that fresh session.
- Re-ran the 12 automated tests, typecheck, lint, Expo Doctor (20/20), and Android/web asset export successfully.
- Motion uses the platform reduced-motion preference. The redesign added no product features; the subsequent transfer/category update is described below.

## Signed balance follow-up

The Everyone’s balance list now displays positive balances with a green +, negative balances with a red minus, and zero balances in a neutral color. Verified the existing demo displays +₹1,400.00, ₹0.00, −₹1,100.00, and −₹300.00. Typecheck and lint pass for this presentation-only change.

## Transfer and category update

- Both group tabs now keep Add a bill and Transfer actions available. A direct transfer selects a sender, recipient, amount and optional note. Same-person transfers are rejected.
- Transfers update balances only; they do not change expense count, group expenses, amount spent, or each person’s bill share. History is labeled Transfers · Not expenses and shows notes on both group tabs.
- Bill entry has a collapsible picker with 13 categories. The category is stored, displayed on the bill card and details, and retained/changeable during editing. Travel maps to the existing Transport storage value for compatibility.
- Added an API regression test covering an advance before any expenses, category edits across all 13 supported values, reverse transfers, deletion, and unchanged spending totals. All 13 tests pass.
- Fresh browser QA in the isolated UI review · Demo group: recorded a synthetic ₹100 advance from Design QA to Lee. Its expense total remained ₹900 and one bill; the sender’s balance changed from ₹600 to ₹700. Added a ₹300 Fuel bill, bringing expenses to ₹1,200, then edited its category to Travel; amounts and shares stayed unchanged.
- Typecheck, lint, and Android/web exports pass for this update. The main four-person demo ledger retains ₹14,000 expenses and ₹1,400 owed back to Alex.

## Limits

No signed APK or physical Android device test has been performed. Native installation, secure storage on hardware, and keyboard/lifecycle behavior remain unverified. No public API hosting or account recovery service is configured.

The prior Expo dependency audit findings remain unresolved; removing camera/media modules does not establish a clean dependency security audit. Development HTTP is for local testing; production configuration requires HTTPS.

## 1.1.0 — activity, offline bills, exports and Android packaging

- 20 automated tests pass. Added author/admin/peer permission checks for bills and transfers, immutable creator ownership, detailed audit changes, retention beyond 300 entries, and idempotent retries including deleted bills and mismatched retry payloads.
- Offline queue tests cover restart recovery, network failure, validation errors, account isolation, concurrent sync, another bill queued during sync, and storage-write failure.
- Browser QA in the isolated UI review · Demo group: disabled its network, saved a ₹450 Food & drinks bill, edited the queued amount to ₹480, then reopened with the API blocked. The cached group and ₹480 draft survived. Unblocking the API automatically produced exactly one confirmed ₹480 bill, ₹1,680 group expenses, ₹560 personal share, and ₹1,220 balance. The main demo ledger was not changed.
- Authenticated PDF/XLSX endpoint tests confirm membership checks, numeric amounts, separate expense/transfer totals, all seven workbook sheets, share reconciliation and available audit history.
- Typecheck, lint, Expo Doctor (20/20), Android/Hermes and web asset exports pass for the feature implementation. Native APK build and further visual/export checks are recorded below when completed.
- Activity notifications refresh in-app while connected; background push and closed-app sync are not implemented. Previously discarded history cannot be restored. Offline creation requires a previously cached identity/group. Browser development assets are not an offline PWA.
