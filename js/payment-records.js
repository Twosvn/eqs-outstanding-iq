(function (root) {
  'use strict';
  function search(records, query) {
    const needle = query.trim().toLowerCase();
    return records.filter(record => record.companyName.toLowerCase().includes(needle) || record.companyNumber.toLowerCase().includes(needle));
  }
  function summary(reviews) {
    if (!reviews.length) return { count: 0, onTime: null };
    return { count: reviews.length, onTime: Math.round(reviews.filter(r => r.outcome === 'on-time').length / reviews.length * 100) };
  }
  function validCompanyNumber(value) { return /^[A-Z0-9]{8}$/.test(value.trim().toUpperCase()); }
  const api = { search, summary, validCompanyNumber };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaymentRecords = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
