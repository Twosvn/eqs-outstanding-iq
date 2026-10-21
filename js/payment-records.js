(function (root) {
  'use strict';
  function search(records, query) {
    const needle = query.trim().toLowerCase();
    return records.filter(record => record.companyName.toLowerCase().includes(needle) || record.companyNumber.toLowerCase().includes(needle));
  }
  function summary(reviews) {
    return { count: reviews.length, unpaid: reviews.filter(r => r.outcome === 'unpaid').length, settled: reviews.filter(r => r.outcome === 'late-paid').length, disputed: reviews.filter(r => r.outcome === 'disputed').length };
  }
  function paymentError({ outcome, due, paid, today }) {
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!['late-paid', 'unpaid', 'disputed'].includes(outcome)) return 'Choose late payment, an unpaid invoice or a disputed invoice.';
    if (!validDate(due) || due >= today) return 'The invoice must already be overdue. Check its due date.';
    if (paid && (!validDate(paid) || paid > today)) return 'Check the payment date. It cannot be in the future.';
    if (outcome === 'late-paid' && (!paid || paid <= due)) return 'A settled late invoice needs a payment date after its due date.';
    if (outcome !== 'late-paid' && paid) return 'For an unpaid or disputed invoice, leave the payment date empty. If it has been settled, choose paid late.';
    return '';
  }
  function validSourceUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.') && !/^(localhost|127\.|0\.|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
    } catch { return false; }
  }
  function validCompanyNumber(value) { return /^[A-Z0-9]{8}$/.test(value.trim().toUpperCase()); }
  const api = { search, summary, validCompanyNumber, paymentError, validSourceUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaymentRecords = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
