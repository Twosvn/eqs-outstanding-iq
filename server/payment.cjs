'use strict';
const { createHash } = require('node:crypto');
const { paymentError, validCompanyNumber, validSourceUrl } = require('../js/payment-records.js');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, min, max, label) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw fail(400, `Check ${label}.`);
  return value.trim();
};
function normalise(kind, input, today) {
  const companyNumber = text(input['company-number'], 8, 8, 'company number').toUpperCase();
  if (!validCompanyNumber(companyNumber)) throw fail(400, 'Enter an 8-character company number.');
  const result = { company_number: companyNumber, company_name: text(input['company-name'], 2, 160, 'company name'), business_name: '', parent_id: null };
  if (kind === 'review') {
    if (input['first-hand'] !== 'confirmed' || input['publication-consent'] !== 'confirmed') throw fail(400, 'Confirm your first-hand experience and publication permission.');
    const payload = { title: text(input.title, 5, 120, 'headline'), experience: text(input.experience, 30, 2000, 'payment experience'), outcome: input.outcome, paymentTerms: text(input['payment-terms'], 1, 80, 'payment terms'), dueDate: input['due-date'], paidDate: input['paid-date'] || null };
    const error = paymentError({ outcome: payload.outcome, due: payload.dueDate, paid: payload.paidDate || '', today });
    if (error) throw fail(400, error);
    result.business_name = text(input['reviewer-business'], 2, 160, 'your business name');
    result.payload = payload;
  } else if (kind === 'source') {
    if (input['payment-only'] !== 'confirmed' || input['private-review'] !== 'confirmed') throw fail(400, 'Confirm that this is a payment-only source for private assessment.');
    const url = text(input['source-url'], 8, 2000, 'source link');
    if (!validSourceUrl(url)) throw fail(400, 'Enter a public http or https source link without login details.');
    if (!['original-reviewer','found-online'].includes(input['source-relationship'])) throw fail(400, 'Choose your connection to the source.');
    result.payload = { sourceUrl: url, relationship: input['source-relationship'], context: text(input['payment-context'], 20, 1000, 'payment context') };
  } else if (kind === 'response') {
    if (input.authority !== 'confirmed') throw fail(400, 'Confirm that you are authorised to represent the business.');
    if (!['response','correction','resolved','removal'].includes(input['request-type'])) throw fail(400, 'Choose a response type.');
    const parent = input['review-reference']?.trim();
    if (parent && !UUID.test(parent)) throw fail(400, 'Enter the full report reference shown on the payment report.');
    result.parent_id = parent || null;
    result.payload = { response: text(input.response, 20, 2000, 'response'), role: text(input.role, 2, 100, 'your role'), requestType: input['request-type'] };
  } else throw fail(400, 'Unknown submission type.');
  return result;
}
function evidenceFile(file) {
  if (!file || typeof file.data !== 'string' || file.data.length > 4194304 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw fail(400, 'Attach one PDF, PNG or JPEG evidence file up to 3 MB.');
  const bytes = Buffer.from(file.data, 'base64');
  if (!bytes.length || bytes.length > 3145728 || bytes.toString('base64') !== file.data) throw fail(400, 'Evidence must be a file up to 3 MB.');
  const types = { 'application/pdf': bytes.subarray(0,5).toString() === '%PDF-', 'image/png': bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 };
  if (!types[file.type]) throw fail(400, 'Evidence must be a genuine PDF, PNG or JPEG file.');
  return { bytes, type: file.type };
}
function createApp({ env = process.env, fetch: request = global.fetch } = {}) {
  const publicKey = () => (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();
  const secretKey = () => (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const authHeaders = (key, token) => ({apikey:key,...(token?{Authorization:`Bearer ${token}`} : key.startsWith('sb_')?{}:{Authorization:`Bearer ${key}`})});
  const config = () => {
    if (!env.SUPABASE_URL || !publicKey() || !secretKey() || !env.SITE_URL) throw fail(503, 'Payment Check is not connected yet. Please try again after setup is complete.');
    const url = new URL(env.SUPABASE_URL);
    const site = new URL(env.SITE_URL);
    if (url.protocol !== 'https:' || site.protocol !== 'https:') throw fail(503, 'Payment Check configuration needs attention.');
    return { url: url.origin, site: site.origin };
  };
  const remote = async (path, { method = 'GET', body, token, service = false, headers = {} } = {}) => {
    const cfg = config();
    const key = service ? secretKey() : publicKey();
    const response = await request(`${cfg.url}${path}`, { method, headers: { ...authHeaders(key,token), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      // Do not log credentials, submitted content, email addresses or provider error bodies.
      if ([401,403].includes(response.status)) throw fail(response.status, 'Please sign in again.');
      if (response.status === 429) throw fail(429, 'Too many attempts. Please wait and try again.');
      if (response.status === 400 || response.status === 422) throw fail(400, 'The request could not be accepted. Check your details, email confirmation and password.');
      if (response.status === 409) throw fail(409, 'This item has changed. Refresh and try again.');
      throw fail(503, 'The payment service could not complete this request. Please try again shortly.');
    }
    if (response.status === 204) return null;
    const raw = await response.text();
    return raw ? JSON.parse(raw) : null;
  };
  const db = (path, options = {}) => remote(`/rest/v1/${path}`, { ...options, service: true });
  const cookie = (name, value, age) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
  const sessionCookies = data => {
    if (!data.access_token || !data.refresh_token) throw fail(503, 'Sign-in did not complete. Please try again.');
    return [cookie('__Host-pc-access', data.access_token, Math.min(data.expires_in || 3600,3600)), cookie('__Host-pc-refresh', data.refresh_token, 2592000)];
  };
  const userFor = async (event, cookies) => {
    const raw = event.headers?.cookie || event.headers?.Cookie || '';
    let values;
    try { values = Object.fromEntries(raw.split(';').map(v => v.trim().split(/=(.*)/s).slice(0,2)).filter(v => v.length===2).map(([k,v]) => [k,decodeURIComponent(v)])); } catch { throw fail(401,'Please sign in.'); }
    let token = values['__Host-pc-access'];
    let user;
    if (token) {
      try { user = await remote('/auth/v1/user', { token }); }
      catch (error) { if (![401,403].includes(error.status)) throw error; }
    }
    if (!user && values['__Host-pc-refresh']) {
      let data;
      try { data = await remote('/auth/v1/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token:values['__Host-pc-refresh'] } }); }
      catch (error) { if ([400,401,403].includes(error.status)) throw fail(401,'Your session has expired. Please sign in again.'); throw error; }
      cookies.push(...sessionCookies(data)); token=data.access_token;
      user = await remote('/auth/v1/user', { token });
    }
    if (!user?.id || !UUID.test(user.id) || !user.email_confirmed_at) throw fail(401, 'Please sign in with a confirmed email address.');
    return { user, token };
  };
  const isAdmin = async id => (await db(`payment_admins?user_id=eq.${id}&select=user_id&limit=1`)).length > 0;
  const getItem = async id => {
    if (!UUID.test(id || '')) throw fail(400, 'Invalid report reference.');
    const rows = await db(`payment_submissions?id=eq.${id}&select=*&limit=1`);
    if (!rows.length) throw fail(404,'Report not found.');
    return rows[0];
  };
  const publicReviews = async query => {
    const offset=Math.max(0,Math.min(100000,parseInt(query.offset,10)||0));
    let path = `payment_public_reviews?select=*&order=publishedAt.desc,id.asc&limit=100&offset=${offset}`;
    if (query.company) {
      if (!validCompanyNumber(query.company)) throw fail(400,'Invalid company number.');
      path += `&companyNumber=eq.${query.company.toUpperCase()}`;
    }
    if (query.id) {
      if (!UUID.test(query.id)) throw fail(400,'Invalid report reference.');
      path += `&id=eq.${query.id}`;
    }
    if (query.q) {
      const q = (query.q.match(/[a-z0-9]+/ig) || []).join(' ').slice(0,100);
      if (q.length < 2) throw fail(400,'Enter at least two letters or numbers.');
      path += `&or=${encodeURIComponent(`(companyName.ilike.*${q}*,companyNumber.ilike.*${q}*)`)}`;
    }
    return remote(`/rest/v1/${path}`);
  };
  async function handler(event) {
    const cookies=[];
    const respond = (statusCode, data, extra={}) => ({ statusCode, headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...extra }, multiValueHeaders: cookies.length ? { 'Set-Cookie':cookies } : {}, body:JSON.stringify(data) });
    try {
      const cfg = config();
      const method = event.httpMethod;
      const query=event.queryStringParameters || {};
      const route=query.route || '';
      let body={};
      if (!['GET','POST','PATCH'].includes(method)) return respond(405,{ error:'Method not allowed.' },{ Allow:'GET, POST, PATCH' });
      if (method !== 'GET') {
        const origin = event.headers?.origin || event.headers?.Origin;
        if (origin !== cfg.site) throw fail(403,'This request must come from the Payment Check website.');
        if (!(event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').startsWith('application/json')) throw fail(415,'Send JSON data.');
        if (!event.body || Buffer.byteLength(event.body)>4500000) throw fail(413,'Submission is too large. Evidence must be up to 3 MB.');
        try { body=JSON.parse(event.body); } catch { throw fail(400,'Invalid submission.'); }
        if (!body || Array.isArray(body) || typeof body !== 'object') throw fail(400,'Invalid submission.');
      }
      if (route==='public' && method==='GET') return respond(200,{ reviews:await publicReviews(query) });
      if (route==='signup' && method==='POST') {
        const email=text(body.email,5,254,'email').toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400,'Enter your email address.');
        const password=body.password;
        if (typeof password!=='string' || password.length<12 || password.length>128) throw fail(400,'Use a password of 12–128 characters.');
        const business=text(body.business,2,160,'business name');
        if (body.terms !== true) throw fail(400,'Accept the account terms and privacy notice.');
        await remote(`/auth/v1/signup?redirect_to=${encodeURIComponent(`${cfg.site}/payment-check/account/`)}`,{method:'POST',body:{email,password,data:{business_name:business,terms_version:'2026-10-21'}}});
        // Even if email confirmation is disabled upstream, do not create a session here.
        return respond(200,{message:'Check your email to confirm your account, then sign in. If you already have an account, sign in or reset your password.'});
      }
      if (route==='login' && method==='POST') {
        const email=text(body.email,5,254,'email').toLowerCase();
        const password=body.password;
        if (typeof password!=='string' || password.length<1 || password.length>128) throw fail(400,'Enter your password.');
        let data;
        try { data=await remote('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}}); }
        catch (error) { if ([400,401,403].includes(error.status)) throw fail(401,'Sign-in failed. Check your email, password and email confirmation.'); throw error; }
        if (!data.user?.email_confirmed_at) throw fail(401,'Confirm your email address before signing in.');
        cookies.push(...sessionCookies(data));
        return respond(200,{message:'Signed in.'});
      }
      if (route==='recover' && method==='POST') {
        const email=text(body.email,5,254,'email').toLowerCase();
        await remote(`/auth/v1/recover?redirect_to=${encodeURIComponent(`${cfg.site}/payment-check/account/`)}`,{method:'POST',body:{email}});
        return respond(200,{message:'If an account exists, a password reset link has been sent.'});
      }
      if (route==='recovery-session' && method==='POST') {
        const email=text(body.email,5,254,'email').toLowerCase();
        const code=text(body.code,6,10,'email recovery code');
        if (!/^\d{6,10}$/.test(code)) throw fail(400,'Enter the recovery code from your email.');
        const data=await remote('/auth/v1/verify',{method:'POST',body:{type:'recovery',email,token:code}});
        if (!data.user?.email_confirmed_at) throw fail(401,'Confirm your email first.');
        cookies.push(...sessionCookies(data));
        return respond(200,{message:'Choose a new password.'});
      }
      if (route==='logout' && method==='POST') {
        try {
          const session=await userFor(event,cookies);
          await remote('/auth/v1/logout?scope=local',{method:'POST',token:session.token});
        } catch(error) { if (![400,401,403].includes(error.status)) throw error; }
        finally { cookies.push(cookie('__Host-pc-access','',0),cookie('__Host-pc-refresh','',0)); }
        return respond(200,{message:'Signed out.'});
      }
      const {user,token}=await userFor(event,cookies);
      if (route==='me' && method==='GET') return respond(200,{user:{id:user.id,email:user.email,business:user.user_metadata?.business_name || ''},admin:await isAdmin(user.id)});
      if (route==='password' && method==='POST') {
        const password=body.password;
        if (typeof password!=='string' || password.length<12 || password.length>128) throw fail(400,'Use a password of 12–128 characters.');
        await remote('/auth/v1/user',{method:'PUT',token,body:{password}});
        cookies.push(cookie('__Host-pc-access','',0),cookie('__Host-pc-refresh','',0));
        return respond(200,{message:'Password updated. Sign in with your new password.'});
      }
      if (route==='mine' && method==='GET') {
        const offset=Math.max(0,Math.min(10000,parseInt(query.offset,10)||0));
        return respond(200,{items:await db(`payment_submissions?owner_id=eq.${user.id}&select=id,kind,company_name,company_number,status,created_at,published_at,moderation_note,version&order=created_at.desc&limit=25&offset=${offset}`)});
      }
      if (route==='submit' && method==='POST') {
        const id=body.id;
        if (!UUID.test(id || '')) throw fail(400,'Invalid submission reference. Please reload the page.');
        const record=normalise(body.kind,body.fields || {},new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'}));
        const fingerprint=createHash('sha256').update(JSON.stringify({kind:body.kind,record,evidence:body.evidence || null})).digest('hex');
        const existing=await db(`payment_submissions?id=eq.${id}&select=id,owner_id,fingerprint&limit=1`);
        if (existing.length) {
          if (existing[0].owner_id!==user.id || existing[0].fingerprint!==fingerprint) throw fail(409,'This reference is already used. Change a field and try again.');
          return respond(200,{id,message:'Your submission was already saved. It is in your account.'});
        }
        if (record.parent_id) {
          const parent=await getItem(record.parent_id);
          if (parent.kind!=='review' || parent.status!=='approved' || parent.company_number!==record.company_number) throw fail(400,'The report reference must match a published report for this company.');
        }
        let evidencePath=null;
        if (body.kind==='review') {
          const file=evidenceFile(body.evidence);
          evidencePath=`${user.id}/${id}`;
          const response=await request(`${cfg.url}/storage/v1/object/payment-evidence/${evidencePath}`,{method:'POST',headers:{...authHeaders(secretKey()),'Content-Type':file.type,'x-upsert':'false'},body:file.bytes,signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw fail(503,'Evidence upload failed. Your report has not been submitted. Please try again.');
        }
        try {
          await db('payment_submissions',{method:'POST',body:{id,owner_id:user.id,kind:body.kind,...record,contact_email:user.email,evidence_path:evidencePath,fingerprint},headers:{Prefer:'return=minimal'}});
        } catch (error) {
          // A timed-out insert may still have committed. Verify before removing private evidence.
          let absent=false;
          try {
            const saved=await db(`payment_submissions?id=eq.${id}&select=id,owner_id,fingerprint&limit=1`);
            if (saved[0]?.owner_id===user.id && saved[0]?.fingerprint===fingerprint) return respond(200,{id,message:'Your submission was saved. It is in your account.'});
            absent=saved.length===0;
          } catch { /* Keep private evidence when the database outcome is unknown. */ }
          if (evidencePath && absent) {
            try { await remote('/storage/v1/object/payment-evidence',{method:'DELETE',service:true,body:{prefixes:[evidencePath]}}); } catch { /* Private orphans can be removed by the storage administrator. */ }
          }
          throw error;
        }
        return respond(201,{id,message:body.kind==='source'?'Link saved for private assessment.':'Saved for review. Your submission is not public.'});
      }
      if (route==='withdraw' && method==='POST') {
        const item=await getItem(body.id);
        if (item.owner_id!==user.id) throw fail(403,'You cannot withdraw this submission.');
        const rows=await db(`payment_submissions?id=eq.${item.id}&version=eq.${item.version}`,{method:'PATCH',body:{status:'withdrawn',last_changed_by:user.id,version:item.version+1},headers:{Prefer:'return=representation'}});
        if (!rows.length) throw fail(409,'The submission changed. Refresh and try again.');
        return respond(200,{message:'Submission withdrawn. It is no longer published.'});
      }
      const admin=await isAdmin(user.id);
      if (route==='evidence' && method==='GET') {
        const item=await getItem(query.id);
        if (item.owner_id!==user.id && !admin) throw fail(403,'You cannot access this evidence.');
        if (!item.evidence_path) throw fail(404,'No evidence is attached.');
        const response=await request(`${cfg.url}/storage/v1/object/authenticated/payment-evidence/${item.evidence_path}`,{headers:{...authHeaders(secretKey())},signal:AbortSignal.timeout(12000)});
        if (!response.ok) throw fail(503,'Evidence could not be downloaded.');
        return {statusCode:200,headers:{'Content-Type':response.headers.get('content-type') || 'application/octet-stream','Content-Disposition':`attachment; filename="evidence-${item.id}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},multiValueHeaders:cookies.length?{'Set-Cookie':cookies}:{},body:Buffer.from(await response.arrayBuffer()).toString('base64'),isBase64Encoded:true};
      }
      if (route==='admin' && method==='GET') {
        if (!admin) throw fail(403,'Administrator access required.');
        const offset=Math.max(0,Math.min(10000,parseInt(query.offset,10)||0));
        return respond(200,{items:await db(`payment_submissions?select=*&order=created_at.desc&limit=25&offset=${offset}`)});
      }
      if (route==='moderate' && method==='PATCH') {
        if (!admin) throw fail(403,'Administrator access required.');
        const item=await getItem(body.id);
        if (body.version!==item.version) throw fail(409,'This submission changed. Refresh before moderating it.');
        if (!['approved','rejected','withdrawn','reviewed'].includes(body.status) || (item.kind==='source' && body.status==='approved') || (item.kind==='review' && body.status==='reviewed')) throw fail(400,'Choose an appropriate moderation action.');
        let payload=item.payload;
        if (body.status==='approved') {
          if (item.status==='withdrawn') throw fail(400,'Withdrawn submissions cannot be republished. Ask the author for a new submission.');
          if (body.checks?.identity!==true || body.checks?.evidence!==true || body.checks?.permission!==true) throw fail(400,'Confirm identity, evidence/authority and publication permission before approval.');
          if (item.kind==='review' && !item.evidence_path) throw fail(400,'Review evidence is required.');
          if (item.kind==='response') {
            if (!item.parent_id || item.payload.requestType!=='response') throw fail(400,'Only a response linked to a report can be published. Handle corrections, resolutions and removals separately.');
            const parent=await getItem(item.parent_id);
            if (parent.kind!=='review' || parent.status!=='approved' || parent.company_number!==item.company_number) throw fail(400,'A response needs a matching published report.');
          }
          if (item.kind==='review' && body.outcome) {
            const error=paymentError({outcome:body.outcome,due:item.payload.dueDate,paid:body.paidDate || '',today:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})});
            if (error) throw fail(400,error);
            payload={...item.payload,outcome:body.outcome,paidDate:body.paidDate || null};
          }
        }
        const note=typeof body.note==='string'?body.note.trim().slice(0,1000):'';
        const rows=await db(`payment_submissions?id=eq.${item.id}&version=eq.${item.version}`,{method:'PATCH',body:{status:body.status,payload,moderation_note:note,reviewed_by:user.id,last_changed_by:user.id,verification:body.status==='approved'?{identity:true,evidence:true,permission:true}:item.verification,published_at:body.status==='approved'?new Date().toISOString():item.published_at,version:item.version+1},headers:{Prefer:'return=representation'}});
        if (!rows.length) throw fail(409,'This submission changed. Refresh and try again.');
        return respond(200,{message:'Moderation saved.'});
      }
      throw fail(404,'Endpoint not found.');
    } catch (error) {
      const status=error.status || 503;
      return respond(status,{error:error.status?error.message:'The payment service is temporarily unavailable. Please try again.'});
    }
  }
  return {handler,publicReviews,config};
}
module.exports={createApp,normalise,evidenceFile,UUID};
