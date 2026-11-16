import { canonicalBookingPdf } from './canonicalBookingPdf';
export const generateBookingPDF = async (booking, fileName = null, driver = null, vehicle = null, type = 'booking_confirmation') => {
  try {
    const blob = await canonicalBookingPdf({ ...booking, hirerName: booking.hirerName || booking.name, hirerPhone: booking.hirerPhone || booking.phone, pickupLocation: booking.pickupLocation || booking.pickup, driverName: driver?.name, vehicleRegistration: vehicle?.registration }, type);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(fileName || 'Spires-Taxis-' + type + '-' + (booking.bookingNumber || 'booking')).replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { window.alert(error.message || 'The PDF could not be generated. Please retry.'); }
};
