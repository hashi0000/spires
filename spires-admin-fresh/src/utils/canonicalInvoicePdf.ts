import { ensureDocumentRenderer } from './canonicalBookingPdf';
export async function canonicalInvoicePdf(input: unknown): Promise<Blob> {
 await ensureDocumentRenderer();
 const { generateInvoicePDF } = await import('../generatedDocuments/invoicePdfGenerator');
 return new Blob([await generateInvoicePDF(input)],{type:'application/pdf'});
}
export async function downloadInvoiceBlob(blob: Blob, filename: string): Promise<void> {
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
