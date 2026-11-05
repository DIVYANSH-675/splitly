# Google Play release status

Updated 5 November 2026.

- Developer: Divyansh007, developerg675@gmail.com. Existing developer account retained.
- App: SplitBill, `com.divyansh.splitly`; Play app ID `4975475007444706136`.
- EAS: `@meridian-max/splitly`; version 1.3.2, code 10, client commit `8ecbf8d`; build `db82cc9e-e3b0-43a9-8dc7-9b76765ef32f`.
- Internal test: Active; release `1.3.2 (10) · Google sign-in fix`; developer email is the only selected tester. The unrelated Rishikesh tester list was not selected or changed.
- Install invitation: <https://play.google.com/apps/internaltest/4701212314015548936>. Sign in with a selected email and accept the invitation. Propagation can take time. The temporary unreviewed package name is expected before app review.
- Public production: not available. Google requires a closed-test release, 12 testers opted in continuously for 14 days, then an application for production access.
- Saved: privacy policy, no ads, no government affiliation, no health features, expense-ledger financial description, Finance category, public developer contact and store listing.
- Data safety: all 11 selected data types answered and saved as a draft; target-audience prerequisite prevents final submission.
- Pending: build 11 reviewer-demo instructions and target audience; IARC Terms of Use approval and content rating; final Data safety submission; country/tester-list choice; closed testing and production review.
- Build 11 preparation: owner selected a sample-data reviewer demo and ages 9–12 and older. The expanded reviewer demo includes local photos/receipts, synthetic username invitations, claim/new-member joining and local reports. Its API calls never use real accounts or group codes. The client separates ages 9–17 into parent-configured on-device mode and reserves Google/cloud access for adults 18+. Age range, parent PIN record and child ledger are not transmitted by the app. Android backup/device transfer is excluded. Native SDK traffic and the full child flow still need physical-device verification before declaring release readiness.
- Separate owner answers are pending for IARC legal acceptance, use of the existing tester list versus a new list, and India-only versus worldwide availability. None are inferred from the audience answer.
- IARC category/contact are prepared using the developer email and All other app types. The separate IARC legal agreement is not accepted while owner confirmation is pending.

## Assets and disclosures

The listing uses `play-store-assets/`: a 512x512 icon, 1024x500 feature graphic, and two 432x768 screenshots from the actual web rendering of the app with synthetic ledger data. They are not Android-device captures. AI assistance is declared for the icon and feature graphic; screenshots are unedited captures.

Data safety includes Google profile identifiers, expense/settlement data, optional receipt files, group activity, and ML Kit scanner diagnostics/installation IDs. Group-visible records are conservatively disclosed as shared for app functionality. Email, diagnostics and installation IDs are not declared shared with third parties. File uploads and scanner IDs are optional; core account data is required. Photos are marked required because Google profile photos can be imported automatically before the user edits the profile. No advertising purpose is declared.

Privacy: <https://divyansh-675.github.io/splitly/store/privacy.html>.
Deletion requests: <https://divyansh-675.github.io/splitly/store/delete-account.html>.

The owner approved the public support email and manual deletion target. Operational steps are in `ACCOUNT_DELETION.md`.

## Verification boundary

Bundle integrity/signature, package/version/SDK, cleartext policy and 64-bit ELF alignment are checked. 43 automated tests, TypeScript and lint pass. Android device Google OAuth return, camera, date-picker interaction and installation have not been tested on a physical phone. Internal-test publication is not production approval.
