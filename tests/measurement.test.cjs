const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('spires-website/js/measurement.js','utf8');
function browser(host='www.spires-taxis.com', choice='', referrer='', route='', options={}) {
 const cookies = options.cookies || new Map(), events={}, appended=[], nodes=new Map(), storage=new Map();
 if(choice) cookies.set('spires_measurement_consent_v1',encodeURIComponent(JSON.stringify({value:choice,at:Date.now()})));
 const doc={readyState:'complete', title:'Airport transfers', referrer, head:{appendChild(el){appended.push(el)}},body:{appendChild(el){appended.push(el);nodes.set(el.id,el)},getAttribute(name){return name==='data-wa-route'?route:''}},getElementById(id){return nodes.get(id)},addEventListener(n,fn){events[n]=fn},createElement(tag){return {tag,children:[],style:{},setAttribute(){},appendChild(el){this.children.push(el)},remove(){nodes.delete(this.id)}}}};
 Object.defineProperty(doc,'cookie',{get(){return [...cookies].map(([k,v])=>k+'='+v).join('; ')},set(v){const [p,...attrs]=v.split(';');const at=p.indexOf('=');if(attrs.some(a=>/Max-Age=0$/.test(a.trim())))cookies.delete(p.slice(0,at));else cookies.set(p.slice(0,at),p.slice(at+1))}});
 const win={crypto:require('node:crypto'),location:{protocol:'https:',hostname:host,origin:'https://'+host,pathname:'/claim',search:options.search === undefined ? '?t=SECRET&email=private@example.com&gclid=click123' : options.search},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout,clearTimeout};
 vm.runInNewContext(code,{window:win,document:doc,URL,URLSearchParams,Date,Promise});
 return {win,doc,appended,cookies,events,nodes};
}
test('local and preview hosts do not load Google or record events',()=>{for(const host of ['localhost','127.0.0.1','preview.vercel.app']){const b=browser(host,'granted');b.win.SpiresMeasurement.lead('1','website');assert.equal(b.appended.length,0);assert.equal(b.win.dataLayer,undefined)}});
test('no measurement request or lead event before a choice',()=>{const b=browser();assert.equal(b.appended.some(n=>n.tag==='script'),false);b.win.SpiresMeasurement.lead('1','website');assert.equal(b.win.dataLayer.length,1)});
test('future-dated consent never loads Google',()=>{
 const cookies=new Map([['spires_measurement_consent_v1',encodeURIComponent(JSON.stringify({value:'granted',at:Date.now()+86400000}))]]);
 const b=browser('www.spires-taxis.com','','','',{cookies});
 assert.equal(b.appended.some(n=>n.tag==='script'),false);
});
test('accepted measurement sanitises URLs and deduplicates success events',()=>{const b=browser('customer.spires-taxis.com','granted');const config=b.win.dataLayer.find(r=>r[0]==='config')[2];assert.equal(config.page_location,'https://customer.spires-taxis.com/portal?gclid=click123');assert.equal(config.page_title,'Spires Customer Portal');assert.equal(config.page_referrer,'');assert.equal(b.appended.filter(n=>n.tag==='script').length,1);b.win.SpiresMeasurement.lead('1','portal');b.win.SpiresMeasurement.lead('1','portal');const leads=b.win.dataLayer.filter(r=>r[0]==='event'&&r[1]==='generate_lead');assert.equal(leads.length,1);assert.equal(leads[0][2].lead_type,'booking_request');assert.equal(JSON.stringify(leads).includes('SECRET'),false)});
test('rejecting measurement clears attribution and prevents future leads',()=>{const b=browser('www.spires-taxis.com','granted');b.win.SpiresMeasurement.preferences();b.nodes.get('spires-measurement-choice').children.find(n=>n.textContent==='Reject measurement').onclick();const size=b.win.dataLayer.length;b.win.SpiresMeasurement.lead('2','website');assert.equal(b.win.dataLayer.length,size);assert.equal(b.cookies.has('spires_measurement_context_v1'),false)});
test('referrer queries are dropped and contact clicks stay free of personal data',()=>{
 const b=browser('www.spires-taxis.com','granted','https://chatgpt.com/share?email=private@example.com','oxford-to-heathrow');
 assert.equal(b.win.dataLayer.find(r=>r[0]==='config')[2].page_referrer,'https://chatgpt.com/share');
 b.events.click({target:{closest:()=>({getAttribute:()=>'mailto:bookings@spires-taxis.com'})}});
 b.events.click({target:{closest:()=>({getAttribute:()=>'mailto:bookings@spires-taxis.com'})}});
 b.events.click({target:{closest:()=>({getAttribute:()=>'https://wa.me/447776897772?text=hello'})}});
 b.events.click({target:{closest:()=>({getAttribute:()=>'tel:+447776897772'})}});
 b.events.click({target:{closest:()=>({getAttribute:()=>'https://customer.spires-taxis.com'})}});
 const names=b.win.dataLayer.filter(r=>r[0]==='event').map(r=>String(r[1]));
 assert.equal(names.join(','),'email_click,whatsapp_click,phone_click');
 const wa=b.win.dataLayer.find(r=>r[1]==='whatsapp_click')[2];
 assert.equal(String(wa.airport_route),'oxford-to-heathrow');
 assert.equal(JSON.stringify(b.win.dataLayer).includes('private@example.com'),false);
 assert.equal(JSON.stringify(b.win.dataLayer).includes('bookings@'),false);
});
test('a direct visit does not replace a stored click and campaign text cannot carry an email', async () => {
 const b=browser('www.spires-taxis.com','granted','https://www.google.com/search','oxford-to-heathrow');
 b.win.location.search='?gclid=click123&utm_source=private@example.com&utm_medium=cpc';
 const first=await b.win.SpiresMeasurement.attribution();
 assert.equal(first.gclid,'click123');
 assert.equal(first.utmSource,undefined);
 assert.equal(first.utmMedium,'cpc');
 assert.equal(first.referrerHost,'www.google.com');
 assert.equal(JSON.stringify(first).includes('private@'),false);
 b.win.location.search='';
 b.doc.referrer='https://spires-taxis.com/oxford-to-heathrow';
 const second=await b.win.SpiresMeasurement.attribution();
 assert.equal(second.gclid,'click123');
 assert.equal(second.latest.gclid,'click123');
});
test('a token in a referrer path is not sent',()=>{
 const b=browser('www.spires-taxis.com','granted','https://chatgpt.com/share/Abcd1234token5678path','');
 assert.equal(b.win.dataLayer.find(r=>r[0]==='config')[2].page_referrer,'https://chatgpt.com/share');
});
test('a saved enquiry can be a contact, a quote or a booking request, once',()=>{
 const b=browser('www.spires-taxis.com','granted');
 b.win.SpiresMeasurement.lead('enq1','website','contact');
 b.win.SpiresMeasurement.lead('enq1','website','contact');
 b.win.SpiresMeasurement.lead('ST100','website','quote');
 b.win.SpiresMeasurement.lead('book1','portal','booking_request');
 const leads=b.win.dataLayer.filter(r=>r[0]==='event'&&r[1]==='generate_lead');
 assert.equal(leads.map(r=>String(r[2].lead_type)).join(','),'contact,quote,booking_request');
 assert.equal(leads.map(r=>String(r[2].lead_channel)).join(','),'website,website,portal');
 for (const lead of leads) {
  assert.equal(Object.keys(lead[2]).map(String).sort().join(','),'lead_channel,lead_type,page_location,transport_type');
  assert.equal(lead[2].page_location.includes('SECRET'),false);
  assert.equal(lead[2].page_location.includes('private@'),false);
 }
});
test('portal and marketing tracker copies stay identical',()=>assert.equal(code,fs.readFileSync('customer-app/public/measurement.js','utf8')));
test('withdrawal in another subdomain stops an open tab and an in-flight attribution read',async()=>{
 const web=browser('www.spires-taxis.com','granted');
 const pending=web.win.SpiresMeasurement.attribution();
 const portal=browser('customer.spires-taxis.com','','','',{cookies:web.cookies,search:''});
 portal.win.SpiresMeasurement.preferences();
 portal.nodes.get('spires-measurement-choice').children.find(n=>n.textContent==='Reject measurement').onclick();
 web.win.SpiresMeasurement.lead('withdrawn','website');
 web.events.click({target:{closest:()=>({getAttribute:()=>'tel:+447776897772'})}});
 assert.equal(await pending,null);
 assert.equal(web.win.dataLayer.filter(r=>r[0]==='event').length,0);
});
test('signup is separate from leads and never transmits its deduplication key',()=>{
 const b=browser('customer.spires-taxis.com','granted');
 b.win.SpiresMeasurement.signup('private-user-id');b.win.SpiresMeasurement.signup('private-user-id');
 const events=b.win.dataLayer.filter(r=>r[0]==='event');
 assert.equal(events.length,1);assert.equal(events[0][1],'sign_up');
 assert.equal(JSON.stringify(events).includes('private-user-id'),false);
});
test('withdrawal retains an opaque retry receipt and cannot be overwritten by offline reconsent',async()=>{
 const b=browser('www.spires-taxis.com','granted');
 const attribution=await b.win.SpiresMeasurement.attribution();
 assert.match(attribution.consentReceiptId,/^[0-9a-f-]{36}$/);
 b.win.SpiresMeasurement.preferences();
 b.nodes.get('spires-measurement-choice').children.find(n=>n.textContent==='Reject measurement').onclick();
 const pending=b.cookies.get('spires_measurement_withdrawal_v1');assert.ok(pending);
 b.win.SpiresMeasurement.preferences();
 b.nodes.get('spires-measurement-choice').children.find(n=>n.textContent==='Allow measurement').onclick();
 assert.equal(await b.win.SpiresMeasurement.attribution(),null);
 assert.equal(b.cookies.get('spires_measurement_withdrawal_v1'),pending);
});
test('all marketing pages use a single bootstrap, not the old tag',()=>{const names=fs.readdirSync('spires-website',{recursive:true}).filter(name=>name.endsWith('.html')).map(name=>'spires-website/'+name);for(const name of names){const html=fs.readFileSync(name,'utf8');assert.equal(html.includes('googletagmanager.com/gtag/js'),false,name);assert.ok((html.match(/src="\/js\/measurement.js"/g)||[]).length<=1,name)}});


test('GA4 sees validated campaign tags while private URL parameters stay out',()=>{
 const b=browser('www.spires-taxis.com','granted','','',{search:'?utm_source=google&utm_medium=cpc&utm_campaign=spires_us_heathrow_oxford_test&utm_content=arrival&email=private@example.com&t=SECRET'});
 const config=b.win.dataLayer.find(r=>r[0]==='config')[2];
 const url=new URL(config.page_location);
 assert.equal(url.searchParams.get('utm_source'),'google');
 assert.equal(url.searchParams.get('utm_medium'),'cpc');
 assert.equal(url.searchParams.get('utm_campaign'),'spires_us_heathrow_oxford_test');
 assert.equal(url.searchParams.get('utm_content'),'arrival');
 assert.equal(url.searchParams.has('email'),false);
 assert.equal(url.searchParams.has('t'),false);
 assert.equal(config.cookie_domain,'spires-taxis.com');
});

test('invalid campaign fields cannot expose contact details to GA4',()=>{
 const b=browser('www.spires-taxis.com','granted','','',{search:'?utm_source=private@example.com&utm_campaign=07700900000&utm_term=https://private.example'});
 const url=new URL(b.win.dataLayer.find(r=>r[0]==='config')[2].page_location);
 assert.equal(url.search,'');
});

test('consented campaign attribution survives website to signed in portal navigation',async()=>{
 const web=browser('www.spires-taxis.com','granted','','',{search:'?gclid=validClick&utm_source=google&utm_medium=cpc&utm_campaign=heathrow_arrivals'});
 const portal=browser('customer.spires-taxis.com','','https://www.spires-taxis.com/heathrow-to-oxford-taxi','',{cookies:web.cookies,search:''});
 const attribution=await portal.win.SpiresMeasurement.attribution();
 assert.equal(attribution.gclid,'validClick');
 assert.equal(attribution.utmCampaign,'heathrow_arrivals');
 assert.equal(attribution.latest.utmSource,'google');
 assert.equal(attribution.referrerHost,undefined);
 portal.win.SpiresMeasurement.lead('savedPortal','portal');
 assert.equal(portal.win.dataLayer.filter(r=>r[1]==='generate_lead').length,1);
});

test('organic search survives internal navigation without being labelled paid',async()=>{
 const web=browser('www.spires-taxis.com','granted','https://www.google.be/search','',{search:''});
 const portal=browser('customer.spires-taxis.com','','https://www.spires-taxis.com/','',{cookies:web.cookies,search:''});
 const attribution=await portal.win.SpiresMeasurement.attribution();
 assert.equal(attribution.referrerHost,'www.google.be');
 assert.equal(attribution.gclid,undefined);
});

test('a rejected choice shared with the portal prevents tracking there too',async()=>{
 const web=browser('www.spires-taxis.com','denied','','',{search:'?gclid=validClick'});
 const portal=browser('customer.spires-taxis.com','','https://www.spires-taxis.com/','',{cookies:web.cookies,search:''});
 assert.equal(await portal.win.SpiresMeasurement.attribution(),null);
 portal.win.SpiresMeasurement.lead('notMeasured','portal');
 assert.equal(portal.appended.some(el=>el.tag==='script'),false);
 assert.equal(portal.win.dataLayer.some(r=>r[0]==='event'),false);
});


test('expired in-memory attribution cannot survive an expired shared cookie',async()=>{
 const b=browser('www.spires-taxis.com','granted','','',{search:'?gclid=oldClick'});
 const saved=JSON.parse(decodeURIComponent(b.cookies.get('spires_measurement_context_v1')));
 saved.expiresAt=Date.now()-1;
 b.cookies.set('spires_measurement_context_v1',encodeURIComponent(JSON.stringify(saved)));
 b.win.location.search='';
 const result=await b.win.SpiresMeasurement.attribution();
 assert.equal(result.gclid,undefined);
});
