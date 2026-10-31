import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Bookings from './Bookings';
import { Booking } from '../types/types';

jest.mock('../utils/firebase', () => ({ functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: () => jest.fn() }));
jest.mock('../utils/pdfGenerator', () => ({ generateBookingConfirmationPdfBlob: jest.fn() }));

const booking = (id: string, name: string): Booking => ({
  id, bookingNumber: id, hirerName: name, hirerPhone: '07000000000', hirerAddress: '',
  pickupLocation: 'Oxford', destination: 'Diddly Squat Farm', pickupTime: '2026-10-31T16:30:00Z',
  dateTime: '2026-10-31T16:30:00Z', bookingMethod: 'internet', status: 'awaiting_customer_confirmation',
  actualFare: 42.50, amountReceivedPence: 1250, paymentStatus: 'partial', quoteAcceptanceSubstatus: 'awaiting_payment',
});
const callbacks = {
  onAddBooking: jest.fn(), onEditBooking: jest.fn(), onSaveBookingDirect: jest.fn(),
  onDeleteBooking: jest.fn(), onGeneratePDF: jest.fn(), onDuplicateBooking: jest.fn(), onCreateReturnBooking: jest.fn(),
};

test('shows the deposit balance and gives an accepted quote a payment action', () => {
  const row = booking('SP1', 'Test Customer');
  render(<Bookings bookings={[row]} drivers={[]} vehicles={[]} {...callbacks} />);
  expect(screen.getByText('Received £12.50 · Remaining £30.00')).toBeTruthy();
  expect(screen.getByText('Awaiting payment')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Record deposit or payment' }));
  expect(callbacks.onEditBooking).toHaveBeenCalledWith(row);
  expect(screen.getByRole('button', { name: 'Delete' }).closest('details')?.hasAttribute('open')).toBe(false);
});

test('search remains applied when a month filter is selected', () => {
  const { container } = render(<Bookings bookings={[booking('SP1', 'Alice'), booking('SP2', 'Bob')]} drivers={[]} vehicles={[]} {...callbacks} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search bookings' }), { target: { value: 'Alice' } });
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(container.querySelector('input[type="month"]')!, { target: { value: '2026-10' } });
  expect(screen.getByText('Alice')).toBeTruthy();
  expect(screen.queryByText('Bob')).toBeNull();
});
