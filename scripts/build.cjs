'use strict';
const fs = require('node:fs');
const path = require('node:path');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function companyPages(records, output, sitemap) {
  const companies = new Map();
  for (const review of records) {
    if (!/^[A-Z0-9]{8}$/.test(review.companyNumber)) throw new Error('Invalid company number');
    if (!companies.has(review.companyNumber)) companies.set(review.companyNumber, []);
    companies.get(review.companyNumber).push(review);
  }
  let urls = '';
  const labels = { 'late-paid': 'Paid late, now settled', unpaid: 'Still unpaid at review date', disputed: 'Invoice disputed' };
  for (const [number, reviews] of companies) {
    const name = reviews[0].companyName;
    const url = `https://fynrec.com/payment-check/companies/${number}/`;
    const articles = reviews.map(r => `<article class="review-card"><span class="outcome-label">${escape(labels[r.outcome])}</span><h2>${escape(r.title)}</h2><p>${escape(r.experience)}</p><p class="review-meta">${escape(r.reviewerBusiness)} · Published ${escape(r.publishedAt)} · Agreed terms: ${escape(r.paymentTerms)} · Invoice due: ${escape(r.dueDate)}${r.paidDate ? ` · Paid: ${escape(r.paidDate)}` : ''} · Reference: ${escape(r.id)}</p>${r.response ? `<div class="company-response"><strong>Company response</strong><p>${escape(r.response.text)}</p><p class="review-meta">Published ${escape(r.response.publishedAt)}</p></div>` : ''}<a href="/payment-check/#respond">Respond, correct or update this review →</a></article>`).join('\n');
    const html = `<!doctype html><html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(name)} Payment Reviews | Fynrec</title><meta name="description" content="Payment experiences for ${escape(name)} (${number}). Read supplier reviews and company responses on Fynrec Payment Check."><link rel="canonical" href="${url}"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"><script src="/components.js" defer></script><link rel="stylesheet" href="/css/payment-check.css"></head><body class="payment-check"><div id="site-nav"></div><main class="container profile-section"><a href="/payment-check/companies/">← Browse companies</a><h1>${escape(name)} payment experiences</h1><p>Companies House number: ${number}</p><a href="https://find-and-update.company-information.service.gov.uk/company/${number}" rel="noopener noreferrer" target="_blank">View company registration ↗</a><p class="muted">These reports cover late or unpaid business invoices. They are not a complete payment history, a credit score or a guarantee of future payment.</p>${articles}<div class="response-prompt"><a href="/payment-check/#share">Share a payment experience →</a><a href="/payment-check/#respond">Respond or report an issue →</a></div></main><div id="site-footer"></div></body></html>`;
    const dir = path.join(output, 'payment-check', 'companies', number);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    urls += `<url><loc>${url}</loc></url>\n`;
  }
  const indexDir = path.join(output, 'payment-check', 'companies');
  fs.mkdirSync(indexDir, { recursive: true });
  const entries = [...companies.entries()].sort((a, b) => a[1][0].companyName.localeCompare(b[1][0].companyName)).map(([number, reviews]) => `<li><a href="/payment-check/companies/${number}/">${escape(reviews[0].companyName)}</a> · ${number} · ${reviews.length} published ${reviews.length === 1 ? 'experience' : 'experiences'}</li>`).join('\n');
  fs.writeFileSync(path.join(indexDir, 'index.html'), `<!doctype html><html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Company Payment Review Directory | Fynrec</title><meta name="description" content="Browse companies with published supplier payment experiences on Fynrec Payment Check."><link rel="canonical" href="https://fynrec.com/payment-check/companies/"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"><script src="/components.js" defer></script><link rel="stylesheet" href="/css/payment-check.css"></head><body class="payment-check"><div id="site-nav"></div><main class="container profile-section"><a href="/payment-check/">← Search companies</a><h1>Company payment review directory</h1><p>Companies with published first-hand payment experiences.</p>${entries ? `<ul>${entries}</ul>` : '<p>No payment reviews have been published yet. Companies are added after review.</p>'}<a href="/payment-check/#share">Share your experience →</a></main><div id="site-footer"></div></body></html>`);
  return sitemap.replace('</urlset>', `${urls}</urlset>`);
}
function build(source = path.resolve(__dirname, '..'), output = path.join(source, 'dist')) {
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const entry of ['index.html', '404.html', 'styles.css', 'components.js', 'css', 'js', 'assets', 'blog', 'payment-check', 'robots.txt', 'debt-collection-birmingham', 'debt-collection-bristol', 'debt-collection-leeds', 'debt-collection-london', 'debt-collection-manchester', 'ecommerce-debt-recovery', 'fashion-debt-recovery', 'logistics-debt-recovery', 'shopify-wholesale-debt-recovery']) {
    if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(output, entry), { recursive: true });
  }
  const reviews = JSON.parse(fs.readFileSync(path.join(source, 'payment-check', 'reviews.json'), 'utf8'));
  const sitemap = companyPages(reviews, output, fs.readFileSync(path.join(source, 'sitemap.xml'), 'utf8'));
  fs.writeFileSync(path.join(output, 'sitemap.xml'), sitemap);
  console.log(`Built public site with ${reviews.length} published reviews. Server code, tests and internal notes excluded.`);
}
module.exports = { companyPages, build };
if (require.main === module) build();
