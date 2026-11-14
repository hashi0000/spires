import { sourceLabel, buildAdvertisingReport } from './advertisingResults';
test('recorded campaign evidence stays separate from Google Ads and customer reported sources',()=>{
  expect(sourceLabel({marketingAttribution:{consent:'granted',first:{utmSource:'chatgpt.com'}}})).toBe('Recorded source: chatgpt.com');
  expect(sourceLabel({marketingAttribution:{consent:'denied',first:{utmSource:'chatgpt.com'}}})).toBe('Unknown');
  expect(sourceLabel({marketingAttribution:{consent:'granted',first:{utmSource:'someone@example.com'}}})).toBe('Unknown');
  expect(sourceLabel({marketingAttribution:{consent:'granted',first:{utmSource:'google'}}})).toBe('Recorded source: google');
});
test('unclassified manual spend is never added to an imported Ads total',()=>{
 const options={from:'2026-11-10',to:'2026-11-10',dateBasis:'enquiry' as const,spend:[{id:'one',date:'2026-11-10',amountPence:1052,source:'manual' as const,label:'Manual Ads total'}],manualSpendIsComplete:false,adsConnected:true,adsSpendPence:1052};
 expect(buildAdvertisingReport([],options).advertisingSpend.pence).toBeNull();
 expect(buildAdvertisingReport([],{...options,manualSpendIsComplete:true}).advertisingSpend.pence).toBe(1052);
});
