const json = (statusCode, body, cache = 'no-store') => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { ...json(405, { error: 'Method not allowed.' }), headers: { ...json(405, {}).headers, Allow: 'GET' } };
  const q = (event.queryStringParameters?.q || '').trim();
  if (q.length < 2 || q.length > 100 || /[\u0000-\u001f]/.test(q)) return json(400, { error: 'Enter between 2 and 100 characters.' });
  const key = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!key) return json(503, { error: 'Registered company search is temporarily unavailable.' });
  try {
    const response = await fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=10`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      // Log status only: never log keys, authorisation headers or upstream bodies.
      console.error('Companies House search failed', { upstreamStatus: response.status });
      if (response.status === 401 || response.status === 403) return json(503, { code: 'REGISTRY_AUTH_FAILED', error: 'The company search connection needs attention. Please try again later.' });
      if (response.status === 429) return json(429, { code: 'REGISTRY_RATE_LIMITED', error: 'Company search has reached its request limit. Please wait a few minutes and try again.' });
      return json(502, { code: 'REGISTRY_UPSTREAM_ERROR', error: 'Companies House search is temporarily unavailable. Please try again later.' });
    }
    const data = await response.json();
    const companies = (data.items || []).map(item => ({
      name: item.title,
      number: item.company_number,
      status: item.company_status,
      location: [item.address?.locality, item.address?.postal_code].filter(Boolean).join(', '),
    })).filter(item => /^[A-Z0-9]{8}$/.test(item.number || '') && typeof item.name === 'string');
    return json(200, { companies }, 'public, max-age=300');
  } catch {
    return json(502, { error: 'Registered company search could not be reached. Please try again.' });
  }
};
