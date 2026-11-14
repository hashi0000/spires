/* Run only with Firebase's disposable demo project. No production credentials or Google collection requests. */
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
if(!/^(127\.0\.0\.1|localhost):8089$/.test(process.env.FIRESTORE_EMULATOR_HOST||'') || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Local Firestore and Auth emulators are required.');
process.env.SPIRES_GA4_API_SECRET='fixture-secret';
const admin=require('../functions/node_modules/firebase-admin');
admin.initializeApp({projectId:'demo-spires-tracking'});
const db=admin.firestore();
const {createCustomerBooking}=require('../functions/lib/terms/callables');
const {recordCustomerAcquisition}=require('../functions/lib/marketing/acquisition');
const {recordBookingSource}=require('../functions/lib/marketing/source');
const {queueBookingMeasurement,deliverBookingMeasurements}=require('../functions/lib/marketing/confirmation');
const {revokeMeasurementConsent,withdrawAccountMeasurement}=require('../functions/lib/marketing/consent');
const {readAdvertisingSpend}=require('../functions/lib/marketing/advertisingSpend');
let collected=0,validated=0;
global.fetch=async url=>{
 if(String(url).startsWith('https://www.google-analytics.com/debug/mp/collect')){validated++;return new Response(JSON.stringify({validationMessages:[]}));}
 if(String(url).startsWith('https://www.google-analytics.com/mp/collect')){collected++;return new Response(null,{status:204});}
 throw new Error('Unexpected network destination in emulator test');
};
(async()=>{
 const user=await admin.auth().createUser({uid:'tracking-'+randomUUID(),email:randomUUID()+'@example.test'});
 const context={auth:{uid:user.uid,token:{email:user.email}}};
 const staff={auth:{uid:'fixture-staff',token:{email:'spirestaxis24@gmail.com'}}};
 const now=Date.now(),receipt=randomUUID();
 const attribution={consent:'granted',consentAt:now,consentGrantedAt:now,consentReceiptId:receipt,capturedAt:now,expiresAt:now+86400000,clientId:'123.456',first:{capturedAt:now,utmSource:'fixture',landingPath:'/oxford-to-stansted-taxi'}};
 const data={submissionId:randomUUID(),termsAccepted:true,termsVersion:'2026-10-25',pickup:'Fixture Oxford',destination:'Fixture Airport',dateTime:'2026-11-16T06:00:00Z',vehicleType:'standard',paymentMethod:'cash',marketingAttribution:attribution};
 await recordCustomerAcquisition.run({marketingAttribution:attribution},context);
 const acquisition=await db.collection('customerAcquisitions').doc(user.uid).get();
 assert.equal(acquisition.data().registeredAt.toMillis(),Date.parse(user.metadata.creationTime));
 const [a,b]=await Promise.all([createCustomerBooking.run(data,context),createCustomerBooking.run(data,context)]);
 assert.equal(a.bookingId,b.bookingId);assert.equal(a.duplicate || b.duplicate,true);
 const booking=db.collection('bookings').doc(a.bookingId),before=await booking.get();
 assert.equal(before.data().marketingAttribution.first.utmSource,'fixture');
 await booking.update({status:'confirmed',confirmedAt:admin.firestore.FieldValue.serverTimestamp()});
 const confirmed=await booking.get(),trigger={params:{bookingId:a.bookingId},timestamp:new Date().toISOString()};
 await queueBookingMeasurement.run({before,after:confirmed},trigger);
 await queueBookingMeasurement.run({before,after:confirmed},trigger);
 const conversions=await db.collection('marketingConversions').where('bookingId','==',a.bookingId).get();
 assert.equal(conversions.size,1);assert.equal(conversions.docs[0].data().occurredAt,confirmed.data().confirmedAt.toMillis());
 await recordBookingSource.run({bookingId:a.bookingId,source:'google_ads',channel:'telephone'},staff);
 await recordBookingSource.run({bookingId:a.bookingId,source:'website',channel:'whatsapp'},staff);
 assert.equal((await db.collection('bookingSourceAudit').where('bookingId','==',a.bookingId).get()).size,2);
 assert.equal((await booking.get()).data().marketingAttribution.first.utmSource,'fixture');
 let status;
 const response={set(){return this;},status(code){status=code;return this;},send(){return this;}};
 await revokeMeasurementConsent({method:'POST',headers:{},get:()=> 'https://www.spires-taxis.com',body:{receipt},ip:'127.0.0.1'},response);
 assert.equal(status,204);assert.equal((await booking.get()).data().marketingAttribution.consent,'denied');
 await db.collection('marketingConfig').doc('ga4').set({enabled:true});
 await deliverBookingMeasurements.run({});
 assert.equal((await conversions.docs[0].ref.get()).data().status,'skipped');assert.equal(collected,0);
 const fresh={...attribution,consentReceiptId:randomUUID(),consentAt:Date.now(),consentGrantedAt:Date.now()};
 const next=await createCustomerBooking.run({...data,submissionId:randomUUID(),marketingAttribution:fresh},context);
 const nextRef=db.collection('bookings').doc(next.bookingId),nextBefore=await nextRef.get();
 await nextRef.update({status:'confirmed',confirmedAt:admin.firestore.FieldValue.serverTimestamp()});
 await queueBookingMeasurement.run({before:nextBefore,after:await nextRef.get()},{params:{bookingId:next.bookingId},timestamp:new Date().toISOString()});
 await deliverBookingMeasurements.run({});await deliverBookingMeasurements.run({});
 assert.equal(collected,1);assert.equal(validated,1);
 await withdrawAccountMeasurement.run({},context);
 assert.equal((await nextRef.get()).data().marketingAttribution.consent,'denied');
 assert.equal((await acquisition.ref.get()).data().marketingAttribution.consent,'denied');
 await db.collection('marketingAdsDaily').doc('fixture').set({date:'2026-11-10',accountId:'7328566496',currency:'GBP',costMicros:10520000,retrievedAt:admin.firestore.FieldValue.serverTimestamp(),provenance:'supermetrics_google_ads',reportingTimezone:'Europe/London',completeDay:true});
 assert.equal((await readAdvertisingSpend.run({from:'2026-11-10',to:'2026-11-10'},staff)).spendPence,1052);
 assert.equal((await readAdvertisingSpend.run({from:'2026-11-10',to:'2026-11-11'},staff)).available,false);
 console.log('PASS: real Auth + Firestore demo journey, concurrent retries, confirmation deduplication, source history, receipt/account withdrawal, one stubbed Google delivery, and spend coverage.');
 await admin.app().delete();
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{setTimeout(()=>process.exit(process.exitCode||0),100);});

