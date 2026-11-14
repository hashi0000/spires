const {test}=require('node:test');const assert=require('node:assert/strict');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:9';
const admin=require('../functions/node_modules/firebase-admin');admin.initializeApp({projectId:'demo-spires-tracking'});
const db=admin.firestore(),stored=new Map();let enabled=true;
db.collection=name=>({doc:id=>({path:name+'/'+id,get:async()=>({data:()=>({enabled,serviceAccountEmail:'spires-ads-reporting@spires-taxis.iam.gserviceaccount.com'})})})});
db.batch=()=>{const writes=[];return{set(ref,row){writes.push([ref.path,row]);},async commit(){for(const [path,row]of writes)stored.set(path,row);}};};
const {syncGoogleAdsSpend}=require('../functions/lib/marketing/googleAdsSync');
test('automatic spend only queries reporting endpoints and keeps old snapshots on failure',async()=>{
 const calls=[];
 const fetcher=async(url,request)=>{
  calls.push({url,body:JSON.parse(request.body)});
  if(url.startsWith('https://iamcredentials.googleapis.com/'))return new Response(JSON.stringify({accessToken:'fixture-token'}));
  assert.equal(url,'https://googleads.googleapis.com/v26/customers/7328566496/googleAds:searchStream');
  const body=JSON.parse(request.body);assert.ok(body.query.startsWith('SELECT '));
  if(body.query.includes('customer.currency_code'))return new Response(JSON.stringify([{results:[{customer:{id:'7328566496',currencyCode:'GBP',timeZone:'Europe/London'}}]}]));
  return new Response(JSON.stringify([]));
 };
 const result=await syncGoogleAdsSpend({sourceToken:async()=> 'fixture-runtime',fetcher});
 assert.equal(result.refreshed,true);assert.equal(result.days,90);assert.equal(calls.length,3);
 assert.equal([...stored.keys()].filter(key=>key.startsWith('marketingAdsDaily/')).length,90);
 assert.ok([...stored.values()].filter(row=>'costMicros'in row).every(row=>row.costMicros===0 && row.completeDay===true));
 const before=JSON.stringify([...stored]);
 await assert.rejects(syncGoogleAdsSpend({sourceToken:async()=> 'fixture-runtime',fetcher:async()=>new Response(null,{status:503})}),/HTTP 503/);
 assert.equal(JSON.stringify([...stored]),before);
 enabled=false;
 const disabled=await syncGoogleAdsSpend({sourceToken:async()=>{throw Error('Must not request a token');}});
 assert.equal(disabled.refreshed,false);
});
