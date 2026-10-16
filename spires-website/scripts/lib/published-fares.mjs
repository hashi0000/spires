import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadPublishedFares() {
  const code = fs.readFileSync(path.join(root, 'js', 'airport-prices.js'), 'utf8');
  const ctx = {
    window: {},
    document: {
      readyState: 'complete',
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: () => {},
    },
  };
  vm.runInNewContext(code, ctx);
  return {
    data: ctx.window.SPIRES_AIRPORT_PRICES,
    classes: ctx.window.SPIRES_VEHICLE_CLASSES,
    formatMoney: ctx.window.SPIRES_formatMoney,
    returnSaving: ctx.window.SPIRES_returnSaving,
  };
}

export function fare(data, routeId, classId, field) {
  const route = data.routes[routeId];
  if (!route) return null;
  const prices = route[classId];
  if (!prices) return null;
  const value = prices[field];
  return typeof value === 'number' && isFinite(value) ? value : null;
}

export function money(amount) {
  if (typeof amount !== 'number' || !isFinite(amount)) return '';
  return '£' + amount.toFixed(0);
}
