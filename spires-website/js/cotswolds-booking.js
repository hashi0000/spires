(function () {
  const form = document.getElementById('booking-form');
  const purpose = document.getElementById('journey-purpose');
  if (!form || !purpose) return;
  if (new URLSearchParams(location.search).get('journeyType') === 'cotswolds') purpose.value = 'cotswolds';
  function update() {
    const active = purpose.value === 'cotswolds';
    const type = document.getElementById('journey');
    if (active && type.value !== 'one_way') { type.value = 'one_way'; type.dispatchEvent(new Event('change', { bubbles: true })); }
    type.disabled = active;
    document.getElementById('cotswolds-fields').hidden = !active;
    document.getElementById('hire-itinerary').required = active;
    document.getElementById('hire-accepted').required = active;
    const duration = Number(document.getElementById('hire-hours').value);
    const vehicle = new FormData(form).get('vehicleType') || 'standard';
    const prices = window.SpiresServicePolicy.cotswolds.prices[vehicle];
    const amount = prices?.[window.SpiresServicePolicy.cotswolds.durationsHours.indexOf(duration)];
    document.getElementById('hire-price').textContent = amount ? 'Starting price £' + amount + ' per vehicle. Route, price and availability are confirmed before booking.' : 'Please select a vehicle for a starting price.';
  }
  form.addEventListener('change', update);
  form.addEventListener('submit', function (event) {
    if (purpose.value === 'cotswolds' && !form.reportValidity()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  update();
})();
