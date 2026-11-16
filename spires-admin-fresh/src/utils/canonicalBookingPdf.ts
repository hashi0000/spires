let vendorReady: Promise<void> | undefined;
export async function ensureDocumentRenderer(): Promise<void> {
  if (!vendorReady) vendorReady = new Promise<void>((resolve, reject) => {
    if ((window as any).PDFDocument) { resolve(); return; }
    const script = document.createElement('script');
    script.src = '/document-assets/pdfkit.standalone.js';
    script.onload = () => resolve();
    script.onerror = () => { vendorReady = undefined; script.remove(); reject(new Error('Could not load the PDF renderer. Please retry.')); };
    document.head.appendChild(script);
  });
  await vendorReady;
}
export async function canonicalBookingPdf(booking: unknown, type = 'booking_confirmation'): Promise<Blob> {
  await ensureDocumentRenderer();
  const renderer = await import('../generatedDocuments/pdfGenerator');
  const bytes = await renderer.generateBookingPDF(booking, type);
  return new Blob([bytes], { type: 'application/pdf' });
}
