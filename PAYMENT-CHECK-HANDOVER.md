# Fynrec Payment Check backend

Branch: `feat/fynrec-payment-check` in `Twosvn/eqs-outstanding-iq`.

## Implemented

- Supabase Postgres for private submissions and an approved public review projection.
- Supabase Auth email/password sign-up, email confirmation, sign-in, password recovery codes, session refresh and sign-out.
- Secure HttpOnly session cookies. Passwords/tokens are never stored in browser local storage or exposed through the public API.
- Signed-in submission of first-hand payment reports, external source leads and company responses/corrections.
- Private PDF/PNG/JPEG evidence, up to 3 MB per report. Evidence downloads check account ownership or administrator status.
- Account dashboard for submission status and withdrawals.
- Administrator moderation with identity/evidence/permission confirmations, optimistic concurrency, resolution updates and a private moderation event log.
- External source links are never automatically fetched, scraped or turned into public reviews.
- Live company/report pages, metadata, native sharing/copy-link controls and sitemap. Only approved reports are public; withdrawal removes the report from Fynrec's public endpoints immediately. External shares/search caches are outside Fynrec's control.
- Server validation, same-origin mutation checks, private table access restrictions, public field allowlisting and idempotent submissions. A database trigger serialises per-account insertion and limits submissions to 20 per 24 hours.
- Existing company search still uses the Companies House key. Existing Fynrec marketing pages and Formspree audit form are preserved.

No Netlify Forms, manual public JSON publishing, paid subscriptions or new npm dependencies are used for Payment Check.

## Live setup — required before launch

The project has NOT been provisioned, migrated or connected in this session. Source and tests are complete locally; live email, database and storage behaviour must be verified after setup.

1. Create a **Supabase Free** project dedicated to Fynrec. Select a suitable region. Keep the project on Free; no paid add-ons are required by this code.
2. In Supabase's SQL editor run `supabase/migrations/202610210001_payment_check.sql` once. It creates private submissions/admin tables, the approved public view, private evidence bucket, insertion limit and moderation history. This file is a first migration, not an idempotent reset script. Do not rerun it over an existing installation.
3. In Netlify, add these **Functions-scoped** variables for the deployment being tested:

   - `SUPABASE_URL`: the project URL.
   - `SUPABASE_PUBLISHABLE_KEY`: the `sb_publishable_...` key.
   - `SUPABASE_SECRET_KEY`: the `sb_secret_...` server key. Never paste it into public files, browser code, Git, screenshots or chat.
   - `SITE_URL`: `https://fynrec.com` for production. For an HTTPS deploy preview, set this to that preview's exact origin in its context.
   - `COMPANIES_HOUSE_API_KEY`: existing live REST key for company lookup.

   Legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` values are also supported, but the new keys above are recommended. New Supabase keys are sent in `apikey`, never as a bearer JWT. Only signed-in user tokens go in `Authorization: Bearer`.
4. In Supabase Auth enable email/password sign-up and **email confirmations**. Set the Site URL to `https://fynrec.com` and add `https://fynrec.com/payment-check/account/` to Redirect URLs. Keep production and preview redirect allowlists explicit.
5. Configure **custom SMTP** for public registration and reset emails. The built-in Supabase sender is restricted to project-team addresses. A free-tier sender such as Resend can be used with a verified sending domain. Keep paid overages disabled and use the sender's Free plan. SMTP credentials belong in Supabase Auth settings, not the site repository.
6. In the **password recovery email template**, include `{{ .Token }}` and direct users to `/payment-check/account/` to enter that code. The account UI verifies a code then offers a new password; it intentionally does not turn URL fragment tokens into sessions. The ordinary email confirmation template can retain its confirmation link; users sign in after confirming.
7. Deploy the branch. Sign up using your admin email and confirm it. Then bootstrap admin access in Supabase SQL using your real account email:

   ```sql
   insert into public.payment_admins(user_id)
   select id from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL')
   on conflict do nothing;
   ```

   This is a SQL-only privilege grant. Neither signing up nor changing user metadata grants moderation access.
8. Open `/payment-check/account/` and `/payment-check/admin/`. Verify the complete acceptance checklist below before inviting users.

The original local checkout remains untouched. The working branch shares the existing repository history. Use `git push -u origin feat/fynrec-payment-check`; no force push is needed. GitHub network access from this session has previously failed, so any push must be confirmed separately.

## Launch checks

- `npm run build` and `npm run check:backend` with configured environment.
- Real email confirmation, sign-in and recovery code delivery through custom SMTP.
- Create a report with a redacted evidence file. Confirm it is saved once after retries and stays private.
- Another ordinary account cannot download its evidence, view its private submission or access moderation.
- Approve the report as an admin. Check the company/report page, share link, metadata and sitemap.
- Submit and approve a matching company response. Reject a response for a different registered company.
- Apply a checked payment resolution. Withdraw a report and confirm its URL returns unavailable and it disappears from the public API/sitemap.
- Source links remain private and cannot be directly approved as reviews.
- Check the Supabase public API with a publishable key: private tables must be denied, the public view must contain only approved public fields and the storage bucket must not be public.
- Check mobile/desktop layouts and form error messages on the HTTPS deployment.
- Review the published account terms/privacy notice for your actual operator, retention practice and contact details before public launch.

## Cost controls

Checked against official pricing on 21 October 2026:

- Supabase Free: 500 MB database, 1 GB file storage, 50,000 monthly active users, 5 GB egress; free projects may pause after one week of inactivity. This is a starting allowance, not unlimited free hosting.
- Evidence is limited to one file up to 3 MB per first-hand report. Only authorised downloads proxy the private file. Do not add public evidence links or unlimited uploads.
- Keep the existing Netlify plan; Functions, bandwidth and hosting remain subject to that plan's usage limits.
- The built-in Supabase email sender is for testing/team recipients. Configure custom SMTP before public registrations. Resend advertises a Free tier with a daily limit of 100 messages; respect its current monthly quota and domain requirements too. Do not enable paid overages without an explicit decision.
- No payment processing, account subscriptions, scheduled keep-alive jobs or paid database features are required.

## Data operations

Reports, responses and source leads are stored in `payment_submissions`. Evidence is in the private `payment-evidence` bucket. Only `payment_public_reviews` is granted public read access. Moderation confirmations and actor IDs stay private; status/outcome changes are logged in `payment_moderation_events`.

Admin notes in this version are explicitly **notes to the submitter**, and appear in their account. Do not put internal confidential notes there. Evidence files are forced downloads, not rendered inline. No malware scanning service is integrated; review downloaded attachments with appropriate local precautions.

Account withdrawals remove public visibility but retain private records. Account/data deletion and storage-retention housekeeping are handled by the operator through Supabase; no automatic retention policy is claimed. Free plan backup/restore capabilities must be checked before storing irreplaceable evidence. The old `reviews.json` was empty and was removed; no production data migration was performed.

## Validation performed here

The automated suite uses mocked Supabase HTTP responses and tests server-side authentication/authorisation, validation, private evidence access, CSRF rejection, duplicate handling, moderation, responses, resolution updates, withdrawal, public rendering and key-header handling. The build excludes server files, migrations, tests and credentials from public hosting.

The live migration was not executed, SMTP delivery and live Supabase APIs were not tested, and browser QA could not be run in this session. `npm run check:backend` currently reports missing configuration until a real project is connected. Those are deployment requirements, not passing integration checks.

## References

- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://resend.com/pricing
