const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const adminPath = path.join(root, 'spires-admin-fresh/src/utils/pdfGenerator.ts');
let source = fs.readFileSync(adminPath, 'utf8');
const start = source.indexOf('export const generateBookingConfirmationPDF =');
if (start < 0) throw new Error('Cannot locate the admin PDF export.');
source = source.slice(0, start);
source = 'import { canonicalBookingPdf } from "./canonicalBookingPdf";\n' + source;
source += `export async function generateBookingConfirmationPdfBlob(booking: Booking, driver?: Driver, vehicle?: Vehicle, type: AdminPDFType = 'booking_confirmation'): Promise<Blob> {
  return canonicalBookingPdf({ ...booking, driverName: driver?.name, vehicleRegistration: vehicle?.registration }, type);
}

export async function generateBookingConfirmationPDF(booking: Booking, driver?: Driver, vehicle?: Vehicle, type: AdminPDFType = 'booking_confirmation'): Promise<void> {
  try {
    const blob = await generateBookingConfirmationPdfBlob(booking, driver, vehicle, type);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Spires-Taxis-' + type + '-' + String(booking.bookingNumber || 'booking').replace(/[^a-zA-Z0-9_-]/g, '') + '.pdf';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { window.alert(error instanceof Error ? error.message : 'The PDF could not be generated. Please retry.'); }
}
`;
fs.writeFileSync(adminPath, source);
fs.writeFileSync(path.join(root, 'customer-app/src/pdfGenerator.js'), `import { canonicalBookingPdf } from './canonicalBookingPdf';
export const generateBookingPDF = async (booking, fileName = null, driver = null, vehicle = null, type = 'booking_confirmation') => {
  try {
    const blob = await canonicalBookingPdf({ ...booking, hirerName: booking.hirerName || booking.name, hirerPhone: booking.hirerPhone || booking.phone, pickupLocation: booking.pickupLocation || booking.pickup, driverName: driver?.name, vehicleRegistration: vehicle?.registration }, type);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(fileName || 'Spires-Taxis-' + type + '-' + (booking.bookingNumber || 'booking')).replace(/\\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { window.alert(error.message || 'The PDF could not be generated. Please retry.'); }
};
`);
