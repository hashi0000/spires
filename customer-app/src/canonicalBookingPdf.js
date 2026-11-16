let vendorReady;
export async function canonicalBookingPdf(booking, type = 'booking_confirmation') {
  if (!vendorReady) vendorReady = new Promise((resolve, reject) => {
    if (window.PDFDocument) { resolve(); return; }
    const script = document.createElement('script');
    script.src = '/document-assets/pdfkit.standalone.js';
    script.onload = resolve;
    script.onerror = () => { vendorReady = undefined; script.remove(); reject(new Error('Could not load the PDF renderer. Please retry.')); };
    document.head.appendChild(script);
  });
  await vendorReady;
  const { generateBookingPDF } = await import('./generatedDocuments/pdfGenerator');
  return new Blob([await generateBookingPDF(booking, type)], { type: 'application/pdf' });
}
