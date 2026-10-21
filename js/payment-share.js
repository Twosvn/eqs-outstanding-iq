'use strict';
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-share-path]');
  if (!button) return;
  const url=new URL(button.dataset.sharePath,location.origin).href;
  const title=button.dataset.shareTitle || 'Fynrec Payment Check';
  let status=button.parentElement.querySelector('.share-status');
  if (!status) {status=document.createElement('span');status.className='share-status muted';status.setAttribute('role','status');button.parentElement.append(status);}
  try {
    if (navigator.share) await navigator.share({title,url});
    else {await navigator.clipboard.writeText(url);status.textContent='Link copied.';}
  } catch(error) {
    if (error.name==='AbortError') return;
    status.textContent='Copy this link: ';
    const input=document.createElement('input');input.type='url';input.value=url;input.readOnly=true;input.setAttribute('aria-label','Share link');status.append(input);input.focus();input.select();
  }
});
