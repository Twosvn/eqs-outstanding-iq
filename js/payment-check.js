/* Public data comes from the approved database view; submissions use the authenticated API. */
'use strict';
const $ = selector => document.querySelector(selector);
let published = [];
let recordsAvailable = true;
let latestSearch = 0;
const outcomes = { 'late-paid': 'Paid late · settled', unpaid: 'Still unpaid at review date', disputed: 'Invoice disputed' };
const textNode = (tag, value, className) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
};
const visibleDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

PaymentAPI.request('me').then(data=>{
  const banner=$('#session-banner');
  banner.textContent=`Signed in as ${data.user.email}. `;
  const account=textNode('a','Manage your reports →');account.href='/payment-check/account/';banner.append(account);
}).catch(()=>{});

async function chooseCompany(company) {
  recordsAvailable = true;
  try { published=(await PaymentAPI.request(`public?company=${encodeURIComponent(company.number)}`)).reviews; } catch { published=[];recordsAvailable=false; }
  $('#company-profile').hidden = false;
  $('#search-results').hidden = true;
  $('#profile-name').textContent = company.name;
  $('#profile-number').textContent = `Company no. ${company.number}${company.status ? ` · Registration status: ${company.status}` : ''}`;
  $('#registry-link').href = `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(company.number)}`;
  for (const form of [$('#review-form'), $('#response-form'), $('#source-form')]) {
    form.elements['company-name'].value = company.name;
    form.elements['company-number'].value = company.number;
  }
  $('#response-form').elements['review-reference'].value = '';
  const reviews = published.filter(record => record.companyNumber === company.number);
  const summary = PaymentRecords.summary(reviews);
  $('#record-summary').replaceChildren();
  for (const [value, label] of [[recordsAvailable ? summary.count : 'Unavailable', 'published payment reports shown'], [recordsAvailable ? summary.unpaid : 'Unavailable', 'reported unpaid'], [recordsAvailable ? summary.settled : 'Unavailable', 'paid late · settled'], [recordsAvailable ? summary.disputed : 'Unavailable', 'reported disputed']]) {
    const stat = textNode('div', '', 'summary-stat');
    stat.append(textNode('strong', value), textNode('span', label, 'muted'));
    $('#record-summary').append(stat);
  }
  $('#company-reviews').replaceChildren();
  if (!reviews.length) {
    const empty = textNode('div', '', 'empty-record');
    empty.append(textNode('h3', recordsAvailable ? 'No published payment experiences yet' : 'Payment records are temporarily unavailable'), textNode('p', recordsAvailable ? 'That does not indicate good or bad payment behaviour. Share a first-hand experience to help build the picture.' : 'Please try again later. We cannot confirm whether this company has any published reviews.'));
    $('#company-reviews').append(empty);
  }
  for (const review of reviews) {
    const article = textNode('article', '', 'review-card');
    article.append(textNode('span', outcomes[review.outcome], 'outcome-label'), textNode('h3', review.title), textNode('p', review.experience));
    article.append(textNode('p', `${review.reviewerBusiness} · ${visibleDate(review.publishedAt)} · Agreed terms: ${review.paymentTerms}`, 'review-meta'));
    article.append(textNode('p', `Invoice due: ${visibleDate(review.dueDate)}${review.paidDate ? ` · Paid: ${visibleDate(review.paidDate)}` : ''} · Reference: ${review.id}`, 'review-meta'));
    if (review.response) {
      const reply = textNode('div', '', 'company-response');
      reply.append(textNode('strong', 'Company response'), textNode('p', review.response.text), textNode('p', visibleDate(review.response.publishedAt), 'review-meta'));
      article.append(reply);
    }
    const permalink = textNode('a', 'Open report →');
    permalink.href = `/payment-check/reports/${encodeURIComponent(review.id)}/`;
    const share=textNode('button','Share report','text-button');share.type='button';share.dataset.sharePath=permalink.href;share.dataset.shareTitle=review.title;article.append(share,document.createElement('br'));
    article.append(permalink, document.createElement('br'));
    const respond = textNode('a', 'Respond, correct or update this review →');
    respond.href = '#respond';
    respond.addEventListener('click', () => { $('#response-form').elements['review-reference'].value = review.id; });
    article.append(respond);
    $('#company-reviews').append(article);
  }
  $('#company-profile').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#profile-name').focus({ preventScroll: true });
}

$('#company-search').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const q = $('#search-query').value.trim();
  if (q.length < 2) { $('#search-query').setCustomValidity('Enter at least two characters.'); $('#search-query').reportValidity(); return; }
  const sequence = ++latestSearch;
  $('#search-results').hidden = false;
  $('#company-profile').hidden = true;
  $('#company-results').replaceChildren();
  $('#search-status').textContent = 'Searching companies…';
  let companies = [];
  let warning = '';
  try {
    const response = await fetch(`/.netlify/functions/company-search?q=${encodeURIComponent(q)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registered company search is temporarily unavailable.');
    companies = data.companies;
  } catch (error) {
    warning = error instanceof SyntaxError ? 'Registered company search is unavailable in this preview.' : error.message;
  }
  try { published=(await PaymentAPI.request(`public?q=${encodeURIComponent(q)}`)).reviews;recordsAvailable=true; } catch {published=[];recordsAvailable=false;}
  if (sequence !== latestSearch) return;
  for (const record of PaymentRecords.search(published, q)) {
    if (!companies.some(company => company.number === record.companyNumber)) companies.push({ name: record.companyName, number: record.companyNumber });
  }
  if (!recordsAvailable) warning += `${warning ? ' ' : ''}Published payment records could not be loaded.`;
  $('#search-status').textContent = `${warning ? `${warning} ` : ''}${companies.length ? `${companies.length} matching ${companies.length === 1 ? 'company' : 'companies'}.` : warning ? (recordsAvailable ? 'You can submit a payment report below using the company’s registered name and number.' : 'Please try again later, or submit a payment report below.') : 'No matching companies found. Check the spelling or try the company number.'}`;
  for (const company of companies) {
    const button = textNode('button', '', 'company-result');
    button.type = 'button';
    button.append(textNode('strong', company.name), textNode('span', `Company no. ${company.number}${company.location ? ` · ${company.location}` : ''} · View payment experiences →`));
    button.addEventListener('click', () => chooseCompany(company));
    $('#company-results').append(button);
  }
  $('#search-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#search-query').addEventListener('input', event => event.target.setCustomValidity(''));
$('#back-results').addEventListener('click', () => { $('#company-profile').hidden = true; $('#search-results').hidden = false; $('#search-query').focus(); });

for (const form of [$('#review-form'), $('#response-form'), $('#source-form')]) {
  form.addEventListener('input',()=>{delete form.dataset.requestId;});
  form.elements['company-number'].addEventListener('input', event => { event.target.value = event.target.value.toUpperCase(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const status = form.querySelector('.form-status');
    if (form.id === 'review-form') {
      const error = PaymentRecords.paymentError({ outcome: form.elements.outcome.value, due: form.elements['due-date'].value, paid: form.elements['paid-date'].value, today: new Date().toLocaleDateString('en-CA') });
      if (error) { status.textContent = error; return; }
    }
    if (form.id === 'source-form' && !PaymentRecords.validSourceUrl(form.elements['source-url'].value)) {
      status.textContent = 'Enter a public http or https link to the original payment complaint, without login details.';
      return;
    }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    status.textContent = 'Sending securely…';
    try {
      const fields=Object.fromEntries(new FormData(form));
      delete fields.evidence;
      const kind={'review-form':'review','response-form':'response','source-form':'source'}[form.id];
      const evidence=kind==='review'?await PaymentAPI.evidence(form.elements.evidence.files[0]):undefined;
      if (!form.dataset.requestId) form.dataset.requestId=crypto.randomUUID();
      const result=await PaymentAPI.request('submit',{id:form.dataset.requestId,kind,fields,evidence});
      status.textContent=`${result.message} Reference: ${result.id}`;
      delete form.dataset.requestId;
      form.reset();
    } catch(error) {
      status.textContent=error.message;
      if (error.status===401) {const link=textNode('a',' Sign in or create an account in a new tab →');link.href='/payment-check/account/';link.target='_blank';link.rel='noopener';status.append(link);}
    } finally { button.disabled = false; }
  });
}

(async()=>{
  const params=new URLSearchParams(location.search);
  const number=params.get('company');
  if (!number || !PaymentRecords.validCompanyNumber(number)) return;
  try {
    const data=await PaymentAPI.request(`public?company=${encodeURIComponent(number)}`);
    if (!data.reviews.length) return;
    await chooseCompany({number:number.toUpperCase(),name:data.reviews[0].companyName});
    if (params.get('report')) $('#response-form').elements['review-reference'].value=params.get('report');
    if (location.hash==='#respond') $('#respond').scrollIntoView({block:'start'});
  } catch { /* The ordinary search and error state remain available. */ }
})();
