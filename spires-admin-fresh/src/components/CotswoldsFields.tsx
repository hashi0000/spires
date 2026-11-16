import React from 'react';
import policy from '../data/servicePolicy.json';

export default function CotswoldsFields({ value, onChange, vehicleType }: { value: any; onChange: (change: any) => void; vehicleType?: string }) {
  const selected = value.journeyType === 'cotswolds';
  const hours = Number(value.hireHours || 6);
  const prices = (policy.cotswolds.prices as Record<string, number[]>)[vehicleType || 'standard'];
  const price = prices?.[policy.cotswolds.durationsHours.indexOf(hours)];
  return <fieldset className="journey-box"><legend>Journey purpose</legend>
    <label>Service<select value={selected ? 'cotswolds' : 'transfer'} onChange={e => onChange({ journeyType: e.target.value, hireHours: value.hireHours || '6', timedHireAccepted: false, ...(e.target.value === 'cotswolds' ? { bookingType: 'one_way', returnTrip: false } : {}) })}>
      <option value="transfer">Transfer or other journey</option><option value="cotswolds">Cotswolds trip / private tour</option>
    </select></label>
    {selected && <>
      <label>Total hire duration<select value={String(hours)} onChange={e => onChange({ hireHours: e.target.value, timedHireAccepted: false })}>{policy.cotswolds.durationsHours.map(hour => <option key={hour} value={hour}>{hour} hours total hire</option>)}</select></label>
      <p>{price ? `Starting price £${price} per vehicle. ` : ''}Your route, price and availability will be confirmed before booking.</p>
      <label>Places to visit and final drop off<textarea value={value.hireItinerary || ''} onChange={e => onChange({ hireItinerary: e.target.value })} required maxLength={2000} /></label>
      <details><summary>Read hire timing and additional charges</summary><p>The total hire runs from the agreed customer pickup time until final drop off. All driving, sightseeing stops, meals, shopping and passenger delays count. Driver travel to collect you does not count. Driver lateness shifts the included finish time.</p>
      <p>Four hours includes travel from Oxford and back; it is not four hours at the attractions. We review your route and recommend a realistic duration. A private car and driver are provided, without guided commentary. Tickets, meals and drinks are not included. Parking arrangements will be stated in the quote.</p>
      <p>Additional time costs £10 per started 20 minutes, per vehicle, for all car types. For example, 21 extra minutes costs £20. Extensions and route changes are subject to availability. Passenger delays and longer visits remain chargeable. Delays solely caused by unexpected accidents, unplanned closures, emergency diversions or severe weather will be reviewed and excluded; normal traffic is allowed for in the itinerary.</p>
      </details>
      <p>Include these terms in the quote. Record customer acceptance through the booking acceptance workflow.</p>
    </>}
  </fieldset>;
}
