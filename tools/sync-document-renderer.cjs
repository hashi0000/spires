/* Generate browser copies of the SAME renderer used for emailed booking PDFs. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'functions/node_modules/typescript'));
const sourceRoot = path.join(root, 'functions/src');
const vendor = path.join(root, 'functions/node_modules/pdfkit/js/pdfkit.standalone.js');
const files = { 'pdfGenerator.ts': 'pdfGenerator', 'invoicePdfGenerator.ts': 'invoicePdfGenerator', 'bankDetails.ts': 'bankDetails', 'airportWaitingPolicy.ts': 'airportWaitingPolicy', 'vehicleTypes.ts': 'vehicleTypes', 'terms/bookingTerms.ts': 'bookingTerms', 'timedHire.ts': 'timedHire', 'paymentAmount.ts': 'paymentAmount' };
for (const app of ['spires-admin-fresh', 'customer-app']) {
  const output = path.join(root, app, 'src/generatedDocuments');
  fs.mkdirSync(output, { recursive: true });
  for (const [file, name] of Object.entries(files)) {
    let source = fs.readFileSync(path.join(sourceRoot, file), 'utf8').replaceAll('./terms/bookingTerms', './bookingTerms');
    if (file === 'pdfGenerator.ts' || file === 'invoicePdfGenerator.ts') {
      source = source.replace(/import PDFDocument from ["']pdfkit["'];/, 'import PDFDocument from "./pdfkitDocument";');
      source = source.replace(/return Buffer\.concat\((buffers|chunks)\);/, (_match, name) => 'const result = new Uint8Array(' + name + '.reduce((sum, chunk) => sum + chunk.length, 0)); let offset = 0; for (const chunk of ' + name + ') { result.set(chunk, offset); offset += chunk.length; } return result;');
    }
    const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, esModuleInterop: true } });
    fs.writeFileSync(path.join(output, name + '.js'), '// GENERATED from functions/src. Edit the source, then run tools/sync-document-renderer.cjs.\n' + result.outputText);
  }
  fs.copyFileSync(path.join(sourceRoot, 'servicePolicy.json'), path.join(output, 'servicePolicy.json'));
  fs.copyFileSync(path.join(sourceRoot, 'documentFonts.json'), path.join(output, 'documentFonts.json'));
  fs.writeFileSync(path.join(output, 'invoicePdfGenerator.d.ts'), 'export function generateInvoicePDF(input: any): Promise<Uint8Array>;\n');
  fs.writeFileSync(path.join(output, 'pdfGenerator.d.ts'), 'export function generateBookingPDF(booking: any, type?: string): Promise<Uint8Array>;\n');
  fs.writeFileSync(path.join(output, 'pdfkitDocument.js'), 'const PDFDocument = window.PDFDocument;\nexport default PDFDocument;\n');
  const publicDir = path.join(root, app, 'public/document-assets');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(vendor, path.join(publicDir, 'pdfkit.standalone.js'));
  fs.copyFileSync(path.join(root, 'functions/node_modules/pdfkit/LICENSE'), path.join(publicDir, 'PDFKIT-LICENSE.txt'));
}

// Sync the collection policy used in booking screens with the server implementation.
const collectionSource = fs.readFileSync(path.join(sourceRoot, 'airportWaitingPolicy.ts'), 'utf8');
fs.writeFileSync(path.join(root, 'spires-admin-fresh/src/utils/airportWaitingPolicy.ts'), collectionSource.replace('./servicePolicy.json', '../data/servicePolicy.json'));
fs.writeFileSync(path.join(root, 'customer-app/src/airportWaitingPolicy.js'), ts.transpileModule(collectionSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText);
