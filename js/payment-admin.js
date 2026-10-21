'use strict';
const $=selector=>document.querySelector(selector);
const node=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
let offset=0;
async function load() {
  const data=await PaymentAPI.request(`admin?offset=${offset}`);
  $('#admin-status').textContent=`Showing ${data.items.length} submissions on this page. Notes below are visible to the submitter.`;
  const list=$('#moderation-items');list.replaceChildren();
  for (const item of data.items) {
    const article=node('article','', 'review-card');
    article.append(node('span',`${item.kind} · ${item.status}`,'outcome-label'),node('h2',item.company_name),node('p',`Company no. ${item.company_number} · Submitter: ${item.contact_email}`),node('p',`Reference: ${item.id}`,'muted'));
    article.append(node('pre',JSON.stringify(item.payload,null,2),'moderation-payload'));
    if (item.evidence_path) {const link=node('a','Download private evidence');link.href=`/api/payment/evidence?id=${item.id}`;article.append(link);}
    if (item.kind==='source') article.append(node('p','Source links are private leads. Confirm the original reviewer’s identity, permission and evidence before asking them to submit a first-hand review. Links are not fetched automatically.','muted'));
    const form=node('form','', 'pc-form');
    const actionLabel=node('label','Action');const action=node('select','');action.name='status';
    const actions=item.kind==='source'?['reviewed','rejected']:item.kind==='response' && item.payload.requestType!=='response'?['reviewed','rejected','withdrawn']:['approved','rejected','withdrawn'];
    for(const value of actions){const option=node('option',value);option.value=value;action.append(option);}actionLabel.append(action);form.append(actionLabel);
    const checks={};
    for (const [name,label] of [['identity','I checked the reviewer’s identity and the registered company.'],['evidence','I checked the transaction evidence or the company representative’s authority.'],['permission','I checked publication permission and removed unnecessary private information.']]) {
      const wrapper=node('label','', 'checkbox-field');const input=document.createElement('input');input.type='checkbox';checks[name]=input;wrapper.append(input,node('span',label));form.append(wrapper);
    }
    let outcome,paid;
    if(item.kind==='review'){
      const label=node('label','Payment outcome after checking any resolution update');outcome=document.createElement('select');
      for(const [value,title] of [['unpaid','Still unpaid'],['late-paid','Paid late, now settled'],['disputed','Overdue invoice disputed']]){const option=node('option',title);option.value=value;option.selected=value===item.payload.outcome;outcome.append(option);}label.append(outcome);form.append(label);
      const dateLabel=node('label','Payment date if settled');paid=document.createElement('input');paid.type='date';paid.value=item.payload.paidDate||'';dateLabel.append(paid);form.append(dateLabel);
    }
    const noteLabel=node('label','Note to submitter');const note=document.createElement('textarea');note.maxLength=1000;note.rows=3;note.value=item.moderation_note;noteLabel.append(note);form.append(noteLabel);
    const button=node('button','Save moderation','btn-primary');button.type='submit';const status=node('p','', 'form-status');status.setAttribute('role','status');form.append(button,status);
    form.addEventListener('submit',async event=>{
      event.preventDefault();button.disabled=true;status.textContent='Saving…';
      try {await PaymentAPI.request('moderate',{id:item.id,version:item.version,status:action.value,note:note.value,checks:Object.fromEntries(Object.entries(checks).map(([key,input])=>[key,input.checked])),...(outcome?{outcome:outcome.value,paidDate:paid.value}:{})},'PATCH');await load();}
      catch(error){status.textContent=error.message;button.disabled=false;}
    });article.append(form);list.append(article);
  }
  $('#previous-items').disabled=offset===0;$('#next-items').disabled=data.items.length<25;
}
$('#previous-items').addEventListener('click',()=>{offset=Math.max(0,offset-25);load().catch(error=>$('#admin-status').textContent=error.message);});
$('#next-items').addEventListener('click',()=>{offset+=25;load().catch(error=>$('#admin-status').textContent=error.message);});
load().catch(error=>{ $('#admin-status').textContent=error.message;if(error.status===401){const a=node('a',' Sign in →');a.href='/payment-check/account/';$('#admin-status').append(a);} });
