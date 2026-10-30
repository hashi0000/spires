import { Booking } from '../types/types';
import {
  accountLinkForBooking,
  buildCustomerSuggestionsFromBookings,
  customerSuggestionLabel,
  matchCustomerSuggestion,
} from './customerSuggestions';

function booking(partial: Record<string, unknown>): Booking {
  return {
    id: String(partial.id || 'b1'),
    bookingNumber: 'SP1',
    dateTime: String(partial.dateTime || partial.pickupTime || '2026-10-01T10:00:00.000Z'),
    hirerName: 'Alex Stone',
    hirerAddress: '1 High Street',
    hirerPhone: '07700900111',
    bookingMethod: 'telephone',
    pickupTime: String(partial.pickupTime || '2026-10-01T10:00:00.000Z'),
    pickupLocation: 'Oxford',
    destination: 'Heathrow',
    status: 'confirmed',
    ...partial,
  } as Booking;
}

describe('customer suggestions for manual jobs', () => {
  const account = booking({
    id: 'account',
    uid: 'user-1',
    email: 'alex@example.com',
    hirerName: 'Alex Stone',
    pickupTime: '2026-09-01T10:00:00.000Z',
  });
  const manual = booking({
    id: 'manual',
    hirerName: 'Alex Stone',
    hirerEmail: 'alex@example.com',
    pickupTime: '2026-10-20T10:00:00.000Z',
    hirerAddress: '2 New Road',
  });

  it('keeps a later manual job on the same account as the earlier email', () => {
    const profiles = buildCustomerSuggestionsFromBookings([manual, account]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].uid).toBe('user-1');
    expect(profiles[0].email).toBe('alex@example.com');
    expect(profiles[0].address).toBe('2 New Road');
    expect(customerSuggestionLabel(profiles[0])).toBe('Alex Stone · alex@example.com');
  });

  it('does not guess when two people share a name', () => {
    const profiles = buildCustomerSuggestionsFromBookings([
      booking({ id: 'a', hirerName: 'Sam', email: 'sam.a@example.com', uid: 'a', hirerPhone: '07700900001' }),
      booking({ id: 'b', hirerName: 'Sam', email: 'sam.b@example.com', uid: 'b', hirerPhone: '07700900002' }),
    ]);
    expect(matchCustomerSuggestion('Sam', profiles)).toBeNull();
    expect(matchCustomerSuggestion('Sam · sam.b@example.com', profiles)?.uid).toBe('b');
  });

  it('links a new job to the account behind the typed email', () => {
    const profiles = buildCustomerSuggestionsFromBookings([account]);
    const picked = matchCustomerSuggestion('Alex Stone', profiles);
    expect(
      accountLinkForBooking({
        typedEmail: 'Alex@Example.com',
        picked,
        suggestions: profiles,
      })
    ).toEqual({ email: 'alex@example.com', uid: 'user-1' });
  });

  it('does not keep an account when the email is changed to someone else', () => {
    const other = booking({
      id: 'other',
      uid: 'user-2',
      email: 'jo@example.com',
      hirerName: 'Jo',
      hirerPhone: '07700900022',
    });
    const profiles = buildCustomerSuggestionsFromBookings([account, other]);
    expect(
      accountLinkForBooking({
        typedEmail: 'jo@example.com',
        picked: profiles.find((profile) => profile.uid === 'user-1') || null,
        suggestions: profiles,
      }).uid
    ).toBe('user-2');
  });
});
