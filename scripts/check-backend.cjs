'use strict';
try {process.loadEnvFile('.env');} catch(error) {if(error.code!=='ENOENT')throw error;}
const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','SITE_URL'];
const missing=required.filter(name=>!process.env[name]);
if(missing.length){console.error(`Not configured: ${missing.join(', ')}. No credentials were printed.`);process.exitCode=1;}
else {
  const {createApp}=require('../server/payment.cjs');
  createApp().publicReviews({}).then(()=>console.log('Public database view is reachable. Next verify email delivery, account access, evidence upload and moderation on the HTTPS deployment.')).catch(()=>{console.error('Database check failed. Check the project credentials and apply the migration. No credentials were printed.');process.exitCode=1;});
}
