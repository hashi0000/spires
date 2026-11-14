import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { isQuoteAdmin } from '../quotes/quoteWorkflow';
import { ADS_ACCOUNT,ADS_REPORTER,ADS_API_VERSION,finishedAdsDates,normalizeAdsReport,streamRows } from './googleAdsReport';

/** Keyless reporting identity. Google Ads grants it Read-only access; no mutate endpoint exists in this module. */
export async function syncGoogleAdsSpend(deps:{sourceToken?:()=>Promise<string>;fetcher?:typeof fetch}={}) {
  const db=admin.firestore(),config=await db.collection('marketingConfig').doc('googleAds').get();
  if(config.data()?.enabled!==true || config.data()?.serviceAccountEmail!==ADS_REPORTER)return {refreshed:false,reason:'The read-only reporting connection is not enabled.'};
  const fetcher=deps.fetcher || fetch;
  const source=await (deps.sourceToken?deps.sourceToken():admin.credential.applicationDefault().getAccessToken().then(result=>result.access_token));
  const minted=await fetcher(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${ADS_REPORTER}:generateAccessToken`,{method:'POST',headers:{Authorization:`Bearer ${source}`,'Content-Type':'application/json'},body:JSON.stringify({scope:['https://www.googleapis.com/auth/adwords'],lifetime:'1800s'}),signal:AbortSignal.timeout(15000)});
  if(!minted.ok)throw new Error(`Reporting identity returned HTTP ${minted.status}`);
  const token=(await minted.json() as {accessToken?:string}).accessToken;
  if(!token)throw new Error('Reporting identity could not obtain an access token');
  const query=async(statement:string)=>{
    const response=await fetcher(`https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${ADS_ACCOUNT}/googleAds:searchStream`,{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:statement}),signal:AbortSignal.timeout(30000),
    });
    if(!response.ok)throw new Error(`Google Ads reporting returned HTTP ${response.status}`);
    return streamRows(await response.json());
  };
  const dates=finishedAdsDates(),from=dates[0],to=dates[dates.length-1];
  const metadata=await query('SELECT customer.id, customer.currency_code, customer.time_zone FROM customer');
  const report=await query(`SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}' ORDER BY segments.date`);
  const rows=normalizeAdsReport(metadata,report,dates);
  const batch=db.batch(),at=admin.firestore.FieldValue.serverTimestamp();
  for(const row of rows)batch.set(db.collection('marketingAdsDaily').doc(`${ADS_ACCOUNT}_${row.date}`),{...row,retrievedAt:at,apiVersion:ADS_API_VERSION});
  batch.set(db.collection('marketingAdsSync').doc('status'),{status:'ready',from,to,days:rows.length,updatedAt:at,accountId:ADS_ACCOUNT,provenance:'google_ads_api'},{merge:true});
  await batch.commit();
  return {refreshed:true,from,to,days:rows.length};
}

export const scheduledAdvertisingSpend=functions.runWith({timeoutSeconds:180}).pubsub.schedule('every 6 hours').timeZone('Europe/London').onRun(async()=>{
  try{return await syncGoogleAdsSpend();}
  catch{
    await admin.firestore().collection('marketingAdsSync').doc('status').set({status:'error',reason:'Google Ads refresh failed. Check read-only access and Cloud API approval.',attemptedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    functions.logger.error('Google Ads reporting refresh failed; stored snapshots were not replaced.');
    return {refreshed:false};
  }
});

export const refreshAdvertisingSpend=functions.runWith({timeoutSeconds:180}).https.onCall(async(_data,context)=>{
  if(!context.auth || !isQuoteAdmin(String(context.auth.token.email || '')))throw new functions.https.HttpsError('permission-denied','Admin access required.');
  try{
    const result=await syncGoogleAdsSpend();
    if(!result.refreshed)throw new functions.https.HttpsError('failed-precondition',result.reason || 'Reporting connection is not ready.');
    return result;
  }catch(error){
    if(error instanceof functions.https.HttpsError)throw error;
    throw new functions.https.HttpsError('unavailable','Google Ads refresh failed. Existing report data was kept.');
  }
});
