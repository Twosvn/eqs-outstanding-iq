# Fynrec Payment Check

Branch: `feat/fynrec-payment-check`.

An additive first version for the existing static Netlify website. No new dependencies. No customer cases, Equisettle records or sample reviews have been imported.

## What works

- `/payment-check/` includes UK company search, company payment profiles, review intake, company response/correction requests and the existing free audit CTA.
- `netlify/functions/company-search.cjs` proxies Companies House search. Set `COMPANIES_HOUSE_API_KEY` in the Netlify site's Functions environment. The API key never enters browser code.
- All three submission forms are statically declared Netlify Forms. Enable form detection, deploy, then confirm `payment-review`, `payment-response` and `payment-source` appear in the Netlify Forms dashboard. Configure email notifications there if wanted.
- Accepted submissions are held in Netlify Forms for manual review. They are not automatically published. Form processing and anti-spam filtering depend on Netlify configuration and plan limits.
- Local previews explicitly do not send submissions. Registry lookup needs the configured Netlify function; without it the page explains the limit and still searches any existing published records.
- The public directory starts empty and displays no score for companies without reviews. A directory load failure displays an unavailable state rather than claiming there are no reviews.

## Deployment

This branch is based on the existing `Twosvn/eqs-outstanding-iq` Git history, cloned from the clean local checkout at `/Users/dos/eqs-production/outstandiq-website`. Its origin is `git@github.com:Twosvn/eqs-outstanding-iq.git`. The current homepage, shared components, location/sector pages and Netlify redirects are retained. Payment Check is linked through the existing shared navigation.

1. Add `payment-check/`, `js/payment-records.js`, `js/payment-check.js`, `css/payment-check.css`, `netlify/functions/company-search.cjs` and `tests/payment-check.test.cjs` to the current Netlify source.
2. Merge `scripts/build.cjs`, `package.json` and the Netlify build settings. The build runs tests, generates the public `dist/` directory, creates indexable company pages for published reviews and adds their URLs to the sitemap. `netlify.toml` publishes only `dist/`, with server functions in `netlify/functions`. This keeps internal source notes, tests and function code out of static hosting. Preserve current site settings.
3. Add the Payment Check navigation link and sitemap URL to the current site. Scope asset cache overrides to the two new JavaScript files and payment-check CSS.
4. Set the Companies House key server-side. Enable Forms and confirm the published submission/privacy notice fits your handling of reviews, before accepting real submissions.
5. Run `npm run build` and `node --check js/payment-check.js`. Run `npm run preview` and open http://127.0.0.1:4173/payment-check/ for local review. Deploy to a Netlify draft first. Confirm a live registry search, a review submission, a response submission, dashboard receipt and failure handling. This session did not perform those live integration checks.

## Moderation and publication

Use Netlify Forms to contact the reviewer privately and check the first-hand transaction, correct registered company and dates. Verify a responding representative's authority. Keep supporting documents out of the public asset folder. Do not use Equisettle case data as reviews without a separate authorised process.

After review, add only the public record below to `payment-check/reviews.json`, run the tests and redeploy. Update a record when a resolution is checked. This is a manual directory, not an automated account/verification or moderation dashboard. Treat the browser form's validation as convenience: manually check all submitted fields before publication.

```json
{
  "id": "PC-UNIQUE-REFERENCE",
  "companyName": "CONFIRMED REGISTERED NAME",
  "companyNumber": "01234567",
  "reviewerBusiness": "CONFIRMED REVIEWER BUSINESS",
  "title": "Reviewed factual headline",
  "experience": "Reviewed payment account without private personal details",
  "outcome": "late-paid",
  "paymentTerms": "30 days",
  "dueDate": "2026-09-01",
  "paidDate": "2026-09-15",
  "publishedAt": "2026-10-21",
  "response": {
    "text": "Optional response from a verified company representative",
    "publishedAt": "2026-10-21"
  }
}
```

Allowed outcomes: `late-paid`, `unpaid`, `disputed`. Omit `paidDate` if unpaid; omit `response` until there is an approved response. Never add email, invoice documents, bank details or internal case information to this public JSON. Payment reviews and debt recovery engagement stay separate; buying recovery services must not be a condition for responding or requesting corrections.

## References

- https://docs.netlify.com/manage/forms/setup/
- https://docs.netlify.com/manage/forms/submissions/
- https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/search-companies
- https://developer-specs.company-information.service.gov.uk/guides/authorisation

## Git handoff

The branch is `feat/fynrec-payment-check`. Run `git push -u origin feat/fynrec-payment-check` from this repository. It shares existing repository history; no force push is required. The live site is not changed by the local commit.

Search-engine indexing requires deployment on an accessible public domain. Company pages are generated only from approved public records; no empty fabricated business profiles or review data are seeded. Registry search needs `COMPANIES_HOUSE_API_KEY`; the published review directory search itself does not.

## Verification in this session

`npm run build` passed with 8 tests. Browser script and preview server syntax checks passed. Browser QA was blocked by session permissions, and the local server could not bind a port (EPERM). Live Companies House and Netlify Forms delivery were not tested. No real submissions or published reviews were created.

## Brand alignment

Payment Check now uses the production `/styles.css` tokens and `/components.js` navigation/footer, including the red primary buttons, Inter type, white backgrounds and existing Fynrec identity. The obsolete separate base stylesheet is removed. Company response copy is shortened to a direct heading and one explanatory paragraph. Generated company pages and the company directory use the same shared components.

## Payment-only scope and external sources

Only overdue B2B invoices and late payments are accepted. No on-time rating or broad business score is shown: the directory is a set of payment-issue reports, not a representative payment history.

`payment-source` is a separate private Netlify Forms queue. A submitted external URL is not fetched by the application, published, counted, or treated as permission to republish. Manually inspect whether it concerns overdue B2B payment and matches the registered company. Seek the original reviewer's confirmation, supporting evidence and written publication permission, check source restrictions, then consider a first-hand review through the same moderation workflow. A submitter who found a link cannot authorise copying another person's review. Record permissions and evidence privately; never place source submissions, correspondence or contact details in public JSON. No automated outreach, scraping, accounts or subscriptions are added.

Enable the new `payment-source` form in Netlify after deploying and test receipt. Source-link assessment and original-reviewer contact remain manual operations, not automated verification.
