'use strict';
const $=selector=>document.querySelector(selector);
const node=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
let offset=0;
// Email confirmations may include tokens in the fragment. Never retain them or use them to silently sign in.
if (location.hash) {const params=new URLSearchParams(location.hash.slice(1));history.replaceState(null,'',location.pathname+location.search);$('#account-status').textContent=params.has('error_description')?'The email link could not be confirmed. Please request a new link.':'Email link opened. Sign in to continue, or use the recovery code from your email to reset your password.';}
async function reports() {
  const data=await PaymentAPI.request(`mine?offset=${offset}`);
  const list=$('#my-reports');list.replaceChildren();
  if (!data.items.length) list.append(node('p','No submissions on this page yet.'));
  for (const item of data.items) {
    const article=node('article','', 'review-card');
    article.append(node('span',`${item.kind} · ${item.status}`,'outcome-label'),node('h3',item.company_name),node('p',`Reference: ${item.id}`,'muted'));
    if (item.moderation_note) article.append(node('p',item.moderation_note));
    if (item.status==='approved' && item.kind==='review') {const link=node('a','Open published report →');link.href=`/payment-check/reports/${item.id}/`;article.append(link);}
    if (item.kind==='review') {const evidence=node('a','Download your evidence');evidence.href=`/api/payment/evidence?id=${item.id}`;evidence.className='evidence-link';article.append(evidence);}
    if (item.status!=='withdrawn') {
      const withdraw=node('button','Withdraw submission','text-button');withdraw.type='button';
      withdraw.addEventListener('click',async()=>{
        if (!window.confirm('Withdraw this submission? Any published report or response will be removed from public view.')) return;
        withdraw.disabled=true;
        try {await PaymentAPI.request('withdraw',{id:item.id});await reports();} catch(error){$('#account-status').textContent=error.message;withdraw.disabled=false;}
      });article.append(withdraw);
    }
    list.append(article);
  }
  $('#previous-reports').disabled=offset===0;
  $('#next-reports').disabled=data.items.length<25;
}
async function account() {
  try {
    const data=await PaymentAPI.request('me');
    $('#auth-forms').hidden=true;$('#my-account').hidden=false;$('#admin-link').hidden=!data.admin;
    $('#account-status').textContent=`Signed in as ${data.user.email}.`;
    await reports();
  } catch(error) {
    $('#auth-forms').hidden=false;$('#my-account').hidden=true;
    if (error.status!==401) $('#account-status').textContent=error.message;
  }
}
for (const id of ['signup','login','recover','recovery-session','password']) {
  const form=$(`#${id}`);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const button=form.querySelector('button');const status=form.querySelector('.form-status');button.disabled=true;status.textContent='Please wait…';
    const fields=Object.fromEntries(new FormData(form));
    if (id==='signup') fields.terms=form.elements.terms.checked;
    try {
      const result=await PaymentAPI.request(id,fields);status.textContent=result.message;
      if (id==='login') {form.reset();await account();}
      if (id==='signup') form.elements.password.value='';
      if (id==='recovery-session') {$('#auth-forms').hidden=true;$('#my-account').hidden=true;$('#password').hidden=false;$('#account-status').textContent=result.message;}
      if (id==='password') {form.reset();$('#password').hidden=true;$('#auth-forms').hidden=false;$('#account-status').textContent=result.message;}
    } catch(error) {status.textContent=error.message;} finally {button.disabled=false;}
  });
}
$('#logout').addEventListener('click',async()=>{try{await PaymentAPI.request('logout',{});location.reload();}catch(error){$('#account-status').textContent=error.message;}});
$('#previous-reports').addEventListener('click',()=>{offset=Math.max(0,offset-25);reports().catch(error=>$('#account-status').textContent=error.message);});
$('#next-reports').addEventListener('click',()=>{offset+=25;reports().catch(error=>$('#account-status').textContent=error.message);});
account();
