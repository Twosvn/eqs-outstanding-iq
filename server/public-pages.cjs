'use strict';
const { createApp, UUID } = require('./payment.cjs');
const { validCompanyNumber } = require('../js/payment-records.js');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? escape(value) : 'Not recorded';
const labels = {'late-paid':'Paid late · settled',unpaid:'Reported unpaid',disputed:'Invoice disputed'};
function page(title, description, path, content, origin) {
  const canonical=`${origin}${path}`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Fynrec</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta name="twitter:card" content="summary"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/payment-check.css"><script src="/components.js" defer></script><script src="/js/payment-share.js" defer></script></head><body class="payment-check"><div id="site-nav"></div><main class="container profile-section document-page"><a href="/payment-check/">← Payment Check</a>${content}</main><div id="site-footer"></div></body></html>`;
}
function report(r) {
  return `<article class="review-card"><span class="outcome-label">${escape(labels[r.outcome])}</span><h2><a href="/payment-check/reports/${escape(r.id)}/">${escape(r.title)}</a></h2><p>${escape(r.experience)}</p><p class="review-meta">${escape(r.reviewerBusiness)} · Published ${date(r.publishedAt)} · Terms: ${escape(r.paymentTerms)} · Due: ${date(r.dueDate)}${r.paidDate?` · Paid: ${date(r.paidDate)}`:''}</p><p class="review-meta">Reference: ${escape(r.id)}</p>${r.response?`<div class="company-response"><strong>Company response</strong><p>${escape(r.response.text)}</p><p class="review-meta">${date(r.response.publishedAt)}</p></div>`:''}<div class="share-actions"><button type="button" class="text-button" data-share-path="/payment-check/reports/${escape(r.id)}/" data-share-title="${escape(r.title)}">Share report</button><a href="/payment-check/?company=${escape(r.companyNumber)}&report=${escape(r.id)}#respond">Respond or request a correction →</a></div></article>`;
}
function createPublicHandler(options) {
  const app=createApp(options);
  return async event => {
    let cfg;
    try {
      cfg=app.config();
      if (!['GET','HEAD'].includes(event.httpMethod)) return {statusCode:405,headers:{Allow:'GET, HEAD'},body:'Method not allowed'};
      const query=event.queryStringParameters || {};
      const offset=Math.max(0,Math.min(100000,parseInt(query.offset,10)||0));
      const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
      if (query.mode==='sitemap') {
        const rows=[];
        for (let start=0; start<50000; start+=100) {
          const batch=await app.publicReviews({offset:start});rows.push(...batch);
          if (batch.length<100) break;
        }
        const numbers=[...new Set(rows.map(r=>r.companyNumber))];
        const urls=[...numbers.map(n=>`${cfg.site}/payment-check/companies/${n}/`),...rows.map(r=>`${cfg.site}/payment-check/reports/${r.id}/`)];
        return {statusCode:200,headers:{...headers,'Content-Type':'application/xml; charset=utf-8'},body:`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`};
      }
      if (query.id) {
        if (!UUID.test(query.id)) return {statusCode:404,headers,body:'Report not found.'};
        const rows=await app.publicReviews({id:query.id});
        if (!rows.length) return {statusCode:404,headers,body:page('Report unavailable','This report is not published.','/payment-check/', '<h1>This report is not available.</h1><p>It may be awaiting review or have been withdrawn.</p>',cfg.site)};
        const r=rows[0];
        return {statusCode:200,headers,body:page(r.title,`Payment report about ${r.companyName}. ${labels[r.outcome]}.`,`/payment-check/reports/${r.id}/`,`<span class="eyebrow">Business payment report</span><h1>${escape(r.companyName)}</h1><p>Company no. ${escape(r.companyNumber)}</p>${report(r)}<p><a href="/payment-check/companies/${escape(r.companyNumber)}/">All published reports for this company →</a></p><p class="muted">An individual payment report is not a complete payment history or a credit score.</p>`,cfg.site)};
      }
      if (query.number && !validCompanyNumber(query.number)) return {statusCode:404,headers,body:'Company not found.'};
      const rows=await app.publicReviews({company:query.number,offset});
      if (query.number) {
        const number=query.number.toUpperCase();
        if (!rows.length && !offset) return {statusCode:404,headers,body:page('No published reports','No published payment reports for this company.','/payment-check/','<h1>No published payment reports.</h1><p>This does not indicate good or bad payment behaviour.</p>',cfg.site)};
        const name=rows[0]?.companyName || number;
        const previous=offset?`<a href="?offset=${Math.max(0,offset-100)}">← Newer reports</a>`:'';
        const next=rows.length===100?`<a href="?offset=${offset+100}">Older reports →</a>`:'';
        return {statusCode:200,headers,body:page(`${name} payment reports`,`Published late-payment and unpaid-invoice reports for ${name}.`,`/payment-check/companies/${number}/`,`<span class="eyebrow">Company payment reports</span><h1>${escape(name)}</h1><p>Company no. ${number}</p><button type="button" class="text-button" data-share-path="/payment-check/companies/${number}/" data-share-title="${escape(name)} payment reports">Share company page</button><p class="muted">These are individual payment-issue reports, not a complete payment history or credit score. Showing up to 100 reports per page.</p>${rows.map(report).join('')}<div class="share-actions">${previous}${next}</div>`,cfg.site)};
      }
      const companies=[...new Map(rows.map(r=>[r.companyNumber,r])).values()];
      const links=companies.map(r=>`<li><a href="/payment-check/companies/${escape(r.companyNumber)}/">${escape(r.companyName)}</a> · ${escape(r.companyNumber)}</li>`).join('');
      return {statusCode:200,headers,body:page('Company payment report directory','Browse companies with published late-payment or unpaid-invoice reports.','/payment-check/companies/',`<h1>Company payment reports</h1><p>Companies with recently published reports. <a href="/payment-check/">Search all company reports →</a></p>${links?`<ul class="company-directory">${links}</ul>`:'<p>No payment reports have been published yet.</p>'}<div class="share-actions">${offset?`<a href="?offset=${Math.max(0,offset-100)}">← Previous</a>`:''}${rows.length===100?`<a href="?offset=${offset+100}">Next →</a>`:''}</div>`,cfg.site)};
    } catch {
      return {statusCode:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},body:'<!doctype html><html lang="en"><title>Payment Check unavailable</title><h1>Payment reports are temporarily unavailable.</h1><p>Please try again shortly.</p></html>'};
    }
  };
}
module.exports={createPublicHandler,page,report,escape};
