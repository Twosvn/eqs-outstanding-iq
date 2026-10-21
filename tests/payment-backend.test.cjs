const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {createApp,normalise,evidenceFile}=require('../server/payment.cjs');
const {createPublicHandler}=require('../server/public-pages.cjs');
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'public-key',SUPABASE_SERVICE_ROLE_KEY:'private-service-key',SITE_URL:'https://fynrec.com'};
const alice={id:'11111111-1111-4111-8111-111111111111',email:'alice@example.com',email_confirmed_at:'2026-01-01',user_metadata:{business_name:'Supplier'}};
const bob={...alice,id:'22222222-2222-4222-8222-222222222222',email:'bob@example.com'};
const admin={...alice,id:'33333333-3333-4333-8333-333333333333',email:'admin@example.com'};
const fields={'company-number':'01234567','company-name':'Example Limited','reviewer-business':'Supplier Limited','payment-terms':'30 days','due-date':'2026-01-01','paid-date':'',outcome:'unpaid',title:'Invoice still unpaid',experience:'We supplied the agreed work and the business invoice is still overdue.','first-hand':'confirmed','publication-consent':'confirmed'};
const evidence={type:'application/pdf',data:Buffer.from('%PDF-1.7\nprivate invoice information').toString('base64')};
const reply={...fields,authority:'confirmed',role:'Finance director','request-type':'response',response:'The payment has now been sent and we are checking receipt.'};
function setup() {
  const items=[],objects=new Map(),calls=[];
  let failAfterInsert=false,failRead=false;
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  function published() {
    return items.filter(r=>r.kind==='review' && r.status==='approved').map(r=>({id:r.id,companyName:r.company_name,companyNumber:r.company_number,reviewerBusiness:r.business_name,...r.payload,publishedAt:r.published_at.slice(0,10),response:items.filter(s=>s.kind==='response' && s.status==='approved' && s.parent_id===r.id).map(s=>({text:s.payload.response,publishedAt:s.published_at.slice(0,10)}))[0] || null}));
  }
  const fetch=async(url,options={})=>{
    const u=new URL(url);const method=options.method||'GET';const data=typeof options.body==='string'?JSON.parse(options.body):options.body;calls.push({url:u.href,method,headers:options.headers,body:data});
    const token=options.headers?.Authorization?.replace('Bearer ','');
    const who={alice,bob,admin}[token];
    if(u.pathname==='/auth/v1/user') {
      if(!who)return json({error:'unauthorised'},401);
      if(method==='PUT')return json(who);
      return json(who);
    }
    if(u.pathname==='/auth/v1/signup')return json({user:alice});
    if(u.pathname==='/auth/v1/recover')return json({});
    if(u.pathname==='/auth/v1/verify')return data.token==='123456'?json({user:alice,access_token:'alice',refresh_token:'alice-refresh',expires_in:3600}):json({},400);
    if(u.pathname==='/auth/v1/token') {
      if(u.searchParams.get('grant_type')==='refresh_token')return json({user:alice,access_token:'alice',refresh_token:'alice-refresh',expires_in:3600});
      return data.password==='correct password'?json({user:alice,access_token:'alice',refresh_token:'alice-refresh',expires_in:3600}):json({},400);
    }
    if(u.pathname==='/auth/v1/logout')return new Response(null,{status:204});
    if(u.pathname.startsWith('/storage/')) {
      assert.equal(options.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
      const name=u.pathname.split('/payment-evidence/')[1];
      if(method==='POST'){if(objects.has(name))return json({},409);objects.set(name,Buffer.from(data));return json({Key:name},201);}
      if(method==='DELETE'){for(const name of data.prefixes)objects.delete(name);return json({});}
      return objects.has(name)?new Response(objects.get(name),{status:200,headers:{'content-type':'application/pdf'}}):json({},404);
    }
    if(u.pathname==='/rest/v1/payment_public_reviews') {
      assert.equal(options.headers.apikey,env.SUPABASE_ANON_KEY);
      let rows=published();
      for(const key of ['companyNumber','id'])if(u.searchParams.has(key))rows=rows.filter(r=>r[key]===u.searchParams.get(key).slice(3));
      const start=Number(u.searchParams.get('offset'))||0;
      return json(rows.slice(start,start+100));
    }
    assert.equal(options.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
    if(u.pathname==='/rest/v1/payment_admins')return json(u.searchParams.get('user_id')===`eq.${admin.id}`?[{user_id:admin.id}]:[]);
    if(u.pathname==='/rest/v1/payment_submissions') {
      if(method==='POST'){
        if(items.some(r=>r.id===data.id))return json({},409);
        items.push({...data,status:'pending',version:1,created_at:'2026-10-21T12:00:00Z',moderation_note:''});
        if(failAfterInsert)throw new Error('network interrupted after commit');
        return new Response(null,{status:201});
      }
      if(failRead)throw new Error('database down');
      let selected=items;
      for(const key of ['id','owner_id','version'])if(u.searchParams.has(key))selected=selected.filter(r=>String(r[key])===u.searchParams.get(key).slice(3));
      if(method==='PATCH'){selected.forEach(r=>Object.assign(r,data));return json(selected);}
      return json(selected.slice(Number(u.searchParams.get('offset'))||0,(Number(u.searchParams.get('offset'))||0)+(Number(u.searchParams.get('limit'))||25)));
    }
    throw new Error(`Unhandled mock request: ${url}`);
  };
  const options={env,fetch};const app=createApp(options);
  const run=(route,body,as='alice',method)=>app.handler({httpMethod:method||(body===undefined?'GET':'POST'),headers:{origin:env.SITE_URL,'content-type':'application/json',cookie:as?`__Host-pc-access=${as}`:''},queryStringParameters:{route},body:body===undefined?undefined:JSON.stringify(body)});
  return {app,run,items,objects,calls,options,setFailAfterInsert:()=>{failAfterInsert=true;},setFailRead:()=>{failRead=true;}};
}
test('server validation rejects on-time, consumer-style sources, unsupported files and missing consents',()=>{
  assert.equal(normalise('review',fields,'2026-10-21').payload.outcome,'unpaid');
  assert.throws(()=>normalise('review',{...fields,outcome:'on-time'},'2026-10-21'));
  assert.throws(()=>normalise('review',{...fields,'first-hand':''},'2026-10-21'));
  assert.throws(()=>normalise('source',{...fields,'source-url':'javascript:alert(1)'},'2026-10-21'));
  assert.throws(()=>evidenceFile({type:'application/pdf',data:Buffer.from('<script>private</script>').toString('base64')}));
  assert.throws(()=>evidenceFile({type:'application/pdf',data:'a'.repeat(4194308)}));
  assert.equal(evidenceFile(evidence).type,'application/pdf');
});
test('backend fails closed without configuration, authentication or same-origin mutation',async()=>{
  const unconfigured=createApp({env:{},fetch:()=>{throw Error('must not fetch');}});
  assert.equal((await unconfigured.handler({httpMethod:'GET',queryStringParameters:{route:'public'}})).statusCode,503);
  const t=setup();
  assert.equal((await t.run('submit',{id:randomUUID(),kind:'review',fields,evidence},null)).statusCode,401);
  assert.equal((await t.run('admin',undefined,'alice')).statusCode,403);
  const response=await t.app.handler({httpMethod:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},queryStringParameters:{route:'signup'},body:'{}'});
  assert.equal(response.statusCode,403);
  assert.ok(!response.body.includes(env.SUPABASE_SERVICE_ROLE_KEY));
});
test('signup requires permission; login issues HttpOnly secure cookies and recovery verifies an emailed code',async()=>{
  const t=setup();
  assert.equal((await t.run('signup',{email:alice.email,password:'long password 123',business:'Supplier'})).statusCode,400);
  assert.equal((await t.run('signup',{email:alice.email,password:'long password 123',business:'Supplier',terms:true})).statusCode,200);
  assert.equal((await t.run('login',{email:alice.email,password:'incorrect'})).statusCode,401);
  const signed=await t.run('login',{email:alice.email,password:'correct password'});
  assert.equal(signed.statusCode,200);
  assert.equal(signed.multiValueHeaders['Set-Cookie'].length,2);
  assert.ok(signed.multiValueHeaders['Set-Cookie'].every(c=>c.includes('HttpOnly; Secure; SameSite=Lax')));
  assert.ok(!signed.body.includes('refresh_token'));
  assert.equal((await t.run('recovery-session',{email:alice.email,code:'000000'})).statusCode,400);
  assert.equal((await t.run('recovery-session',{email:alice.email,code:'123456'})).statusCode,200);
  assert.equal((await t.run('logout',{},null)).statusCode,200);
});
test('private review persists once, cannot be self-approved and publishes only after checked admin approval',async()=>{
  const t=setup();const id=randomUUID();const body={id,kind:'review',fields,evidence};
  assert.equal((await t.run('submit',body)).statusCode,201);
  assert.equal((await t.run('submit',body)).statusCode,200);
  assert.equal(t.items.length,1);assert.equal(t.objects.size,1);
  assert.deepEqual(JSON.parse((await t.run('public',undefined,null)).body).reviews,[]);
  assert.equal((await t.run('moderate',{id,version:1,status:'approved'},'alice','PATCH')).statusCode,403);
  assert.equal((await t.run('moderate',{id,version:1,status:'approved'},'admin','PATCH')).statusCode,400);
  assert.equal((await t.run('moderate',{id,version:1,status:'approved',checks:{identity:true,evidence:true,permission:true}},'admin','PATCH')).statusCode,200);
  const publicResult=await t.run('public',undefined,null);
  assert.equal(JSON.parse(publicResult.body).reviews.length,1);
  for(const secret of [alice.email,'evidence_path','fingerprint','owner_id','private invoice'])assert.ok(!publicResult.body.includes(secret));
  assert.equal((await t.run('moderate',{id,version:1,status:'rejected'},'admin','PATCH')).statusCode,409);
});
test('only the report owner or an admin can access evidence, private accounts or withdraw a report',async()=>{
  const t=setup();const id=randomUUID();await t.run('submit',{id,kind:'review',fields,evidence});
  const evidenceRequest=as=>t.app.handler({httpMethod:'GET',headers:{cookie:`__Host-pc-access=${as}`},queryStringParameters:{route:'evidence',id}});
  assert.equal((await evidenceRequest('bob')).statusCode,403);
  const mine=await evidenceRequest('alice');assert.equal(mine.statusCode,200);assert.equal(mine.isBase64Encoded,true);assert.match(mine.headers['Content-Disposition'],/^attachment/);
  assert.equal((await evidenceRequest('admin')).statusCode,200);
  assert.deepEqual(JSON.parse((await t.run('mine',undefined,'bob')).body).items,[]);
  assert.equal((await t.run('withdraw',{id},'bob')).statusCode,403);
  assert.equal((await t.run('withdraw',{id},'alice')).statusCode,200);
  assert.equal((await t.run('moderate',{id,version:2,status:'approved',checks:{identity:true,evidence:true,permission:true}},'admin','PATCH')).statusCode,400);
});
test('external sources cannot be approved into public reviews or alter published payment statistics',async()=>{
  const t=setup();const id=randomUUID();
  const source={...fields,'source-url':'https://example.com/review','source-relationship':'found-online','payment-context':'This source describes an overdue invoice between businesses.','payment-only':'confirmed','private-review':'confirmed'};
  assert.equal((await t.run('submit',{id,kind:'source',fields:source})).statusCode,201);
  assert.equal((await t.run('moderate',{id,version:1,status:'approved',checks:{identity:true,evidence:true,permission:true}},'admin','PATCH')).statusCode,400);
  assert.equal((await t.run('moderate',{id,version:1,status:'reviewed'},'admin','PATCH')).statusCode,200);
  assert.deepEqual(JSON.parse((await t.run('public',undefined,null)).body).reviews,[]);
  assert.equal(t.objects.size,0);
});
test('an ambiguous database write preserves evidence if the review was committed',async()=>{
  const t=setup();t.setFailAfterInsert();const id=randomUUID();
  const result=await t.run('submit',{id,kind:'review',fields,evidence});
  assert.equal(result.statusCode,200);assert.equal(t.items.length,1);assert.equal(t.objects.size,1);
  assert.ok(!t.calls.some(c=>c.method==='DELETE'));
});
test('published report pages are shareable, escaped and immediately unavailable on withdrawal',async()=>{
  const t=setup();const id=randomUUID();await t.run('submit',{id,kind:'review',fields:{...fields,title:'<script>unsafe</script>'},evidence});
  const render=createPublicHandler(t.options);
  assert.equal((await render({httpMethod:'GET',queryStringParameters:{id}})).statusCode,404);
  await t.run('moderate',{id,version:1,status:'approved',checks:{identity:true,evidence:true,permission:true}},'admin','PATCH');
  const page=await render({httpMethod:'GET',queryStringParameters:{id}});
  assert.equal(page.statusCode,200);assert.ok(page.body.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(page.body.includes('og:url'));assert.ok(page.body.includes('data-share-path'));
  assert.ok(!page.body.includes(alice.email));assert.ok(!page.body.includes('private invoice'));
  const sitemap=await render({httpMethod:'GET',queryStringParameters:{mode:'sitemap'}});assert.ok(sitemap.body.includes(`/reports/${id}/`));
  await t.run('withdraw',{id},'alice');
  assert.equal((await render({httpMethod:'GET',queryStringParameters:{id}})).statusCode,404);
});
test('migration exposes only an approved public projection and keeps evidence and administrative tables private',()=>{
  const sql=readFileSync(require('node:path').join(__dirname,'../supabase/migrations/202610210001_payment_check.sql'),'utf8');
  assert.ok(sql.includes('enable row level security'));
  assert.ok(sql.includes('revoke all on public.payment_admins, public.payment_submissions from anon, authenticated'));
  const view=sql.slice(sql.indexOf('create view'),sql.indexOf('revoke all on public.payment_public_reviews'));
  for(const secret of ['contact_email','evidence_path','fingerprint','sourceUrl'])assert.ok(!view.includes(secret));
  assert.ok(view.includes("r.status='approved'"));
  assert.ok(sql.includes("'payment-evidence','payment-evidence',false"));
  assert.ok(sql.includes('pg_advisory_xact_lock'));
});

test('company responses must match a published report and are checked before appearing',async()=>{
  const t=setup();const id=randomUUID();await t.run('submit',{id,kind:'review',fields,evidence});
  const checks={identity:true,evidence:true,permission:true};
  await t.run('moderate',{id,version:1,status:'approved',checks},'admin','PATCH');
  const bad=await t.run('submit',{id:randomUUID(),kind:'response',fields:{...reply,'company-number':'87654321','review-reference':id}},'bob');
  assert.equal(bad.statusCode,400);
  const responseId=randomUUID();
  assert.equal((await t.run('submit',{id:responseId,kind:'response',fields:{...reply,'review-reference':id}},'bob')).statusCode,201);
  assert.equal(JSON.parse((await t.run('public',undefined,null)).body).reviews[0].response,null);
  assert.equal((await t.run('moderate',{id:responseId,version:1,status:'approved',checks},'admin','PATCH')).statusCode,200);
  assert.equal(JSON.parse((await t.run('public',undefined,null)).body).reviews[0].response.text,reply.response);
  await t.run('withdraw',{id:responseId},'bob');
  assert.equal(JSON.parse((await t.run('public',undefined,null)).body).reviews[0].response,null);
});
test('verified resolution updates change public outcome without creating a new or duplicate report',async()=>{
  const t=setup();const id=randomUUID();await t.run('submit',{id,kind:'review',fields,evidence});
  const checks={identity:true,evidence:true,permission:true};
  const result=await t.run('moderate',{id,version:1,status:'approved',checks,outcome:'late-paid',paidDate:'2026-02-01'},'admin','PATCH');
  assert.equal(result.statusCode,200);
  const data=JSON.parse((await t.run('public',undefined,null)).body).reviews;
  assert.equal(data.length,1);assert.equal(data[0].outcome,'late-paid');assert.equal(data[0].paidDate,'2026-02-01');
});

test('new Supabase keys use apikey headers while user sessions use a bearer JWT',async()=>{
  const modern={SUPABASE_URL:env.SUPABASE_URL,SITE_URL:env.SITE_URL,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test'};
  let checkedPublic=false,checkedUser=false,checkedAdmin=false;
  const app=createApp({env:modern,fetch:async(url,options)=>{
    if(url.includes('/payment_public_reviews')){checkedPublic=true;assert.equal(options.headers.apikey,modern.SUPABASE_PUBLISHABLE_KEY);assert.equal(options.headers.Authorization,undefined);return new Response('[]');}
    if(url.includes('/auth/v1/user')){checkedUser=true;assert.equal(options.headers.Authorization,'Bearer alice');return new Response(JSON.stringify(alice));}
    if(url.includes('/payment_admins')){checkedAdmin=true;assert.equal(options.headers.apikey,modern.SUPABASE_SECRET_KEY);assert.equal(options.headers.Authorization,undefined);return new Response('[]');}
    throw Error('Unexpected request');
  }});
  assert.equal((await app.handler({httpMethod:'GET',queryStringParameters:{route:'public'}})).statusCode,200);
  assert.equal((await app.handler({httpMethod:'GET',headers:{cookie:'__Host-pc-access=alice'},queryStringParameters:{route:'me'}})).statusCode,200);
  assert.ok(checkedPublic&&checkedUser&&checkedAdmin);
});
