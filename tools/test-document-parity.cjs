const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'functions/node_modules/typescript'));
const { generateBookingPDF } = require('../functions/lib/pdfGenerator');
global.window = { PDFDocument: require('../functions/node_modules/pdfkit/js/pdfkit.standalone.js') };
function browserModule(folder, name, cache = new Map()) {
  const file = path.resolve(folder, name.endsWith('.json') || name.endsWith('.js') ? name : name + '.js');
  if (cache.has(file)) return cache.get(file).exports;
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = {exports:{}}; cache.set(file,result);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  new Function('exports','require','module',code)(result.exports, request => {
    if (!request.startsWith('.')) throw new Error('Unexpected browser dependency: '+request);
    return browserModule(path.dirname(file), request, cache);
  }, result);
  return result.exports;
}
const { pdfText } = require('../functions/lib/testPdfText');
const text = bytes => pdfText(Buffer.from(bytes));
const booking = {bookingNumber:'SYN-DOCUMENT',hirerName:'Synthetic Passenger',hirerPhone:'07700900000',pickupTime:'2026-11-16T10:00:00Z',pickupLocation:'Oxford',destination:'Oxford',status:'completed',actualFare:180,amountReceivedPence:5000,paymentStatus:'partial',additionalCharges:[{id:'time',amountPence:2000,reason:'Additional hire time'}],timedHire:{startAt:'2026-11-16T10:00:00Z',includedMinutes:240,itinerary:'Burford, Stow and final Oxford',extraRatePounds:10,extraIntervalMinutes:20}};
(async()=>{
  const server = await generateBookingPDF(booking,'payment_receipt');
  for (const app of ['spires-admin-fresh','customer-app']) {
    const renderer = browserModule(path.join(root,app,'src/generatedDocuments'),'pdfGenerator');
    const browser = await renderer.generateBookingPDF(booking,'payment_receipt');
    assert.deepEqual(text(browser),text(server),app+' must use the same document content');
    assert.match(Buffer.from(browser).toString('latin1'),/MediaBox \[0 0 595\.28 841\.89\]/);
  }
  const output = path.resolve(root,'../..','outputs/spires-validation'); fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'synthetic-payment-receipt.pdf'),server);
  const long = await generateBookingPDF({...booking,notes:'Synthetic long itinerary and assistance details. '.repeat(90)},'booking_confirmation');
  fs.writeFileSync(path.join(output,'synthetic-long-confirmation.pdf'),long);
  assert.match(text(server),/200.00/); assert.match(text(server),/150.00/);
  assert.ok((long.toString('latin1').match(/\/Type \/Page\b/g)||[]).length >= 2);
  console.log('PASS: server, admin and customer PDF contents match; A4 dimensions; fare/extras/deposit balance; long document pagination. Synthetic PDFs saved.');
})().catch(error=>{console.error(error);process.exitCode=1;});
