'use strict';
window.PaymentAPI = {
  async request(route, body, method) {
    const response = await fetch(`/api/payment/${route}`, {method:method || (body===undefined?'GET':'POST'), credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let data;
    try { data=await response.json(); } catch { throw Object.assign(new Error('Payment Check could not be reached. Please try again shortly.'),{status:response.status}); }
    if (!response.ok) throw Object.assign(new Error(data.error || 'The request did not complete.'),{status:response.status});
    return data;
  },
  async evidence(file) {
    if (!file || file.size>3145728 || !['application/pdf','image/png','image/jpeg'].includes(file.type)) throw new Error('Attach one PDF, PNG or JPEG up to 3 MB.');
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('The evidence file could not be read.'));reader.readAsDataURL(file);});
    return {type:file.type,data};
  }
};
