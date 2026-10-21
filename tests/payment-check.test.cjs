const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const records = require('../js/payment-records.js');
const { handler } = require('../netlify/functions/company-search.cjs');
const root = path.resolve(__dirname, '..');

test('published record search accepts company names and numbers without mixing companies', () => {
  const data = [{ companyName: 'First Supplier Limited', companyNumber: '01234567' }, { companyName: 'Another Limited', companyNumber: 'SC123456' }];
  assert.deepEqual(records.search(data, ' FIRST '), [data[0]]);
  assert.deepEqual(records.search(data, 'sc123456'), [data[1]]);
  assert.deepEqual(records.search(data, 'missing'), []);
});
test('payment summaries count cases by outcome without a general payment score', () => {
  assert.deepEqual(records.summary([]), { count: 0, unpaid: 0, settled: 0, disputed: 0 });
  assert.deepEqual(records.summary([{ outcome: 'late-paid' }, { outcome: 'disputed' }, { outcome: 'unpaid' }]), { count: 3, unpaid: 1, settled: 1, disputed: 1 });
});
test('reports must concern an overdue invoice with dates matching the outcome', () => {
  const base = { outcome: 'unpaid', due: '2026-09-01', paid: '', today: '2026-10-21' };
  assert.equal(records.paymentError(base), '');
  assert.equal(records.paymentError({ ...base, outcome: 'late-paid', paid: '2026-09-15' }), '');
  assert.equal(records.paymentError({ ...base, outcome: 'disputed' }), '');
  for (const change of [
    { outcome: 'on-time' }, { due: '2026-10-22' }, { due: '2026-10-21' }, { due: '2026-02-30' },
    { paid: '2026-09-15' }, { outcome: 'late-paid' }, { outcome: 'late-paid', paid: '2026-09-01' },
    { outcome: 'late-paid', paid: '2026-10-22' }, { outcome: 'disputed', paid: '2026-09-10' },
  ]) assert.notEqual(records.paymentError({ ...base, ...change }), '', JSON.stringify(change));
});
test('external source links accept public web URLs without executing or fetching them', () => {
  for (const value of ['https://example.com/payment-review/123', 'http://example.co.uk/review']) assert.equal(records.validSourceUrl(value), true);
  for (const value of ['javascript:alert(1)', 'data:text/html,review', 'file:///review', 'not a url', 'https://username:password@example.com/review', 'http://127.0.0.1/private', 'http://192.168.1.1/review']) assert.equal(records.validSourceUrl(value), false);
});
test('company number validation permits UK prefixes and rejects unsafe identifiers', () => {
  for (const number of ['01234567', 'SC123456', 'ni123456']) assert.equal(records.validCompanyNumber(number), true);
  for (const number of ['123', '<script>', '123456789', '../12345']) assert.equal(records.validCompanyNumber(number), false);
});
test('company search rejects invalid requests before contacting the registry', async () => {
  assert.equal((await handler({ httpMethod: 'POST' })).statusCode, 405);
  for (const q of ['', 'a', 'a'.repeat(101), 'ab\u0000cd']) assert.equal((await handler({ httpMethod: 'GET', queryStringParameters: { q } })).statusCode, 400);
});
test('company search fails clearly without an API key and never exposes upstream private fields', async () => {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  const previousFetch = global.fetch;
  try {
    delete process.env.COMPANIES_HOUSE_API_KEY;
    assert.equal((await handler({ httpMethod: 'GET', queryStringParameters: { q: 'supplier' } })).statusCode, 503);
    process.env.COMPANIES_HOUSE_API_KEY = 'test-secret';
    global.fetch = async (url, options) => {
      assert.match(url, /q=two%20%26%20three/);
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from('test-secret:').toString('base64')}`);
      return { ok: true, json: async () => ({ items: [{ title: 'Example Limited', company_number: '01234567', company_status: 'active', address: { locality: 'London', postal_code: 'SE1 1AA', premises: 'private value' }, other: 'not public' }] }) };
    };
    const result = await handler({ httpMethod: 'GET', queryStringParameters: { q: 'two & three' } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body).companies, [{ name: 'Example Limited', number: '01234567', status: 'active', location: 'London, SE1 1AA' }]);
    assert.ok(!result.body.includes('test-secret'));
    const oldError = console.error;
    const logs = [];
    console.error = (...args) => logs.push(args);
    try {
      for (const [upstream, status, code] of [[401, 503, 'REGISTRY_AUTH_FAILED'], [403, 503, 'REGISTRY_AUTH_FAILED'], [429, 429, 'REGISTRY_RATE_LIMITED'], [500, 502, 'REGISTRY_UPSTREAM_ERROR']]) {
        global.fetch = async () => ({ ok: false, status: upstream });
        const failure = await handler({ httpMethod: 'GET', queryStringParameters: { q: 'supplier' } });
        assert.equal(failure.statusCode, status);
        assert.equal(JSON.parse(failure.body).code, code);
      }
      assert.deepEqual(logs[0], ['Companies House search failed', { upstreamStatus: 401 }]);
      assert.ok(!JSON.stringify(logs).includes('test-secret'));
    } finally { console.error = oldError; }
    global.fetch = async () => { throw new Error('secret upstream details'); };
    const failure = await handler({ httpMethod: 'GET', queryStringParameters: { q: 'supplier' } });
    assert.equal(failure.statusCode, 502);
    assert.ok(!failure.body.includes('secret'));
  } finally {
    global.fetch = previousFetch;
    if (key === undefined) delete process.env.COMPANIES_HOUSE_API_KEY;
    else process.env.COMPANIES_HOUSE_API_KEY = key;
  }
});
test('forms have matching static detection fields and private moderation destination', () => {
  const html = readFileSync(path.join(root, 'payment-check/index.html'), 'utf8');
  for (const name of ['payment-review', 'payment-response', 'payment-source']) {
    assert.ok(html.includes(`name="${name}" method="POST"`));
    assert.ok(html.includes(`name="form-name" value="${name}"`));
  }
  assert.equal((html.match(/data-netlify="true"/g) || []).length, 3);
  const js = readFileSync(path.join(root, 'js/payment-check.js'), 'utf8');
  assert.ok(!js.includes('innerHTML'));
  assert.ok(html.includes('name="submission-type" value="external-payment-source"'));
  assert.ok(html.includes('name="source-url" type="url" required'));
  assert.ok(html.includes('name="payment-only"'));
  assert.ok(!html.includes('<option value="on-time">'));
  assert.ok(js.includes("PaymentRecords.validSourceUrl(form.elements['source-url'].value)"));
  assert.ok(js.includes("$('#source-form')"));
  assert.ok(!js.includes("fetch(form.elements['source-url']"));
  assert.ok(js.includes('Preview only: nothing has been sent.'));
  assert.ok(js.includes('recordsAvailable = false'));
  assert.ok(readFileSync(path.join(root, 'components.js'), 'utf8').includes('href="/payment-check/"'));
});
test('public directory contains only approved public fields and no private contact details', () => {
  const data = JSON.parse(readFileSync(path.join(root, 'payment-check/reviews.json'), 'utf8'));
  const allowed = ['id', 'companyName', 'companyNumber', 'reviewerBusiness', 'title', 'experience', 'outcome', 'paymentTerms', 'dueDate', 'paidDate', 'publishedAt', 'response'];
  const ids = new Set();
  for (const review of data) {
    for (const key of Object.keys(review)) assert.ok(allowed.includes(key), `Unexpected public field: ${key}`);
    for (const key of ['id', 'companyName', 'reviewerBusiness', 'title', 'experience', 'paymentTerms']) assert.ok(typeof review[key] === 'string' && review[key].trim());
    assert.ok(!ids.has(review.id)); ids.add(review.id);
    assert.ok(records.validCompanyNumber(review.companyNumber));
    assert.ok(['late-paid', 'unpaid', 'disputed'].includes(review.outcome));
    for (const key of ['dueDate', 'publishedAt', ...(review.paidDate ? ['paidDate'] : [])]) assert.match(review[key], /^\d{4}-\d{2}-\d{2}$/);
    if (review.response) {
      assert.deepEqual(Object.keys(review.response).sort(), ['publishedAt', 'text']);
      assert.equal(typeof review.response.text, 'string');
      assert.match(review.response.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

test('build generates crawlable company pages, stable links and sitemap without HTML injection', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const { companyPages } = require('../scripts/build.cjs');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'fynrec-pages-'));
  try {
    const fixture = [{ id: 'PC-1', companyName: 'Example <Company>', companyNumber: '01234567', reviewerBusiness: 'Supplier', title: 'Paid late', experience: '<script>not executable</script>', outcome: 'late-paid', paymentTerms: '30 days', dueDate: '2026-09-01', paidDate: '2026-09-12', publishedAt: '2026-10-21', response: { text: 'Resolved', publishedAt: '2026-10-21' } }];
    const sitemap = companyPages(fixture, output, '<urlset></urlset>');
    const html = fs.readFileSync(path.join(output, 'payment-check/companies/01234567/index.html'), 'utf8');
    assert.ok(html.includes('rel="canonical" href="https://fynrec.com/payment-check/companies/01234567/"'));
    assert.ok(html.includes('Example &lt;Company&gt;'));
    assert.ok(html.includes('&lt;script&gt;not executable&lt;/script&gt;'));
    assert.ok(!html.includes('<script>not executable'));
    assert.ok(html.includes('Resolved'));
    assert.ok(html.includes('2026-09-12'));
    assert.ok(sitemap.includes('<loc>https://fynrec.com/payment-check/companies/01234567/</loc>'));
    const index = fs.readFileSync(path.join(output, 'payment-check/companies/index.html'), 'utf8');
    assert.ok(index.includes('href="/payment-check/companies/01234567/"'));
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
