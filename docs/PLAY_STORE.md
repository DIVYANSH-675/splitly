# Google Play release status

Updated 5 November 2026.

The dashboard now shows 8 of 11 setup tasks complete, with content rating, target audience and final Data safety still unfinished. Build 11 is Active and Available to internal testers. No closed test has started.

- Developer: Divyansh007, developerg675@gmail.com. Existing developer account retained.
- App: SplitBill, `com.divyansh.splitly`; Play app ID `4975475007444706136`.
- EAS: `@meridian-max/splitly`; current internal build is 1.3.3/code 11, EAS build `e18c222b-57e7-4640-967a-db6e53b7f4ef`, client `ce1ae3e`. Verified standalone APK previews are built by Android workflow `42034703228`. The release includes extended demo access, normal-format sample QR codes and protection against cloud writes crossing into local mode. Superseded builds were canceled before publication. Signed-bundle verification passed and Play release 3 is published.
- Internal test: Active; release `1.3.3 (11) · Local access and demo`; developer email is the only selected tester. The unrelated Rishikesh tester list was not selected or changed.
- Install invitation: <https://play.google.com/apps/internaltest/4701212314015548936>. Sign in with a selected email and accept the invitation. Propagation can take time. The temporary unreviewed package name is expected before app review.
- Public production: not available. Google requires a closed-test release, 12 testers opted in continuously for 14 days, then an application for production access.
- Saved: privacy policy, no ads, no government affiliation, no health features, expense-ledger financial description, Finance category, public developer contact and store listing.
- Data safety: all 11 selected data types answered and saved as a draft; target-audience prerequisite prevents final submission.
- Saved: updated store description explaining local/adult/demo access; version-specific reviewer-demo access instructions for build 11+, and the no-advertising-ID declaration. These are ready to send for review. The expanded demo is described as isolated sample data, not a connection to real cloud users.
- Pending: target audience; IARC Terms of Use approval and content rating; final Data safety submission; country/tester-list choice; closed testing and production review.
- Build 11 access: owner selected a sample-data reviewer demo and ages 9–12 and older. The expanded reviewer demo includes local photos/receipts, synthetic username invitations, claim/new-member joining and local reports. Its API calls never use real accounts or group codes. The client separates ages 9–17 into parent-configured on-device mode and reserves Google/cloud access for adults 18+. Age range, parent PIN record and child ledger are not transmitted by the app. Android backup/device transfer is excluded. Native SDK traffic and the full child flow still need physical-device verification before declaring release readiness.
- Separate owner answers are pending for IARC legal acceptance, use of the existing tester list versus a new list, and India-only versus worldwide availability. None are inferred from the audience answer.
- Play currently disables ages 9–12 until the content rating is completed. No incomplete 13+ audience choice was saved.
- IARC category/contact are prepared using the developer email and All other app types. The separate IARC legal agreement is not accepted while owner confirmation is pending.

## Assets and disclosures

The listing uses `play-store-assets/`: a 512x512 icon, 1024x500 feature graphic, and two 432x768 screenshots from the actual web rendering of the app with synthetic ledger data. They are not Android-device captures. AI assistance is declared for the icon and feature graphic; screenshots are unedited captures.

Data safety includes Google profile identifiers, expense/settlement data, optional receipt files, group activity, and ML Kit scanner diagnostics/installation IDs. Group-visible records are conservatively disclosed as shared for app functionality. Email, diagnostics and installation IDs are not declared shared with third parties. Receipt uploads are optional. Scanner diagnostics/IDs are drafted as optional based on the user-initiated scanner; native SDK startup behavior still needs confirmation before final Data safety submission. core account data remains marked required for adult cloud functionality. Google Data safety aggregates versions and ages, so the new local mode does not justify declaring that no data is collected by the entire app. Photos are marked required because Google profile photos can be imported automatically before the user edits the profile. No advertising purpose is declared.

Privacy: <https://divyansh-675.github.io/splitly/store/privacy.html>.
Deletion requests: <https://divyansh-675.github.io/splitly/store/delete-account.html>.

The owner approved the public support email and manual deletion target. Operational steps are in `ACCOUNT_DELETION.md`.

## Verification boundary

Bundle integrity/signature, package/version/SDK, cleartext policy and 64-bit ELF alignment are checked. 51 automated tests, TypeScript and lint pass. Android device parent setup, SDK network traffic, Google OAuth return, camera, date-picker interaction and installation have not been tested on a physical phone. Internal-test publication is not production approval.

Play estimates 16.8 MB for a new install and 1.72 MB for an update; the multi-architecture AAB is 80,167,104 bytes. The public [v1.3.3 GitHub prerelease](https://github.com/DIVYANSH-675/splitly/releases/tag/v1.3.3) contains both standalone APK previews, the verified AAB, source archive and checksums. APK preview signing is separate from Play signing.
