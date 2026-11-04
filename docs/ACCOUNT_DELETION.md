# SplitBill account-deletion requests

The developer approved `developerg675@gmail.com` as the public support and deletion address on 4 November 2026, with a target of 30 days after verifying ownership. This is a manual support process, not automatic deletion when someone uninstalls.

1. Monitor the mailbox. Confirm ownership through the Google email linked to the SplitBill account; a matching display name or username alone is insufficient. Never request a Google password or sign-in code.
2. Locate the exact SplitBill user and linked Google identity in the dedicated project `gomowueeizpwzzbqugod`. Review affected data before making changes. Do not touch the unrelated Rishikesh project.
3. Revoke the user's SplitBill sessions before removing account data. In addition to the account tables, inspect every group JSON document for that user ID, member IDs, names, usernames, photos and identifying text. Remove their identifying information and personal records, including relevant receipts and history; recompute any affected totals and balances. Do not silently retain the user's personal financial records under a renamed profile.
4. Remove private attachment data and attachment references for the requester, profile, cached operation responses, backup email and email challenges, OAuth mapping and the SplitBill user record. Account for foreign-key dependencies. Operation responses belonging to other users can also contain snapshots of shared groups; inspect and remove affected cached responses rather than leaving personal data there.
5. Delete the corresponding Supabase Auth user through Authentication > Users after revoking sessions and removing any owned Storage objects if present. SplitBill's own opaque sessions are separate from Supabase JWTs, so both stores need handling. Deleting only an app profile or banning the Auth user is insufficient. Supabase documents that already-issued JWTs can remain valid until expiry; remove app access first.
6. Verify that the old SplitBill sessions fail, no current app table or shared JSON/attachment/operation response retains the removed personal records, and the Auth identity and refresh sessions are removed. Check provider log/backup retention and explain any specific legal/security retention to the requester. Do not claim immediate backup erasure.
7. Confirm completion to the requester as part of the authorized support request. Explain that other people's exported copies and device caches cannot be remotely recalled. The requester should clear local app data after any pending changes are handled.

Do not execute deletion against a live user until a verified request exists. Use the backend's supported finance calculations when updating shared ledgers, and preserve other users' unrelated records.

Public request page: <https://divyansh-675.github.io/splitly/store/delete-account.html>.

Provider guidance: <https://supabase.com/docs/guides/auth/managing-user-data>.
