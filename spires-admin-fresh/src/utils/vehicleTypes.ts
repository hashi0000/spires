export const VEHICLE_TYPE_OPTIONS = [
  { value: 'standard' as const, label: 'Standard Car (up to 4)', examples: 'Toyota RAV4 / Corolla or similar' },
  { value: '8_seater' as const, label: '8 Seater (up to 8)', examples: 'Mercedes Vito or similar' },
];

export type VehicleTypeOption = 'standard' | '8_seater';

export function formatVehicleTypeLabel(type?: string | null): string {
  if (!type) return 'Not specified';
  if (type === '8_seater' || type === '8-seater') return '8 Seater';
  if (type === 'standard') return 'Standard Car';
  return type.replace(/_/g, ' ');
}

export function vehicleClassExamples(type?: string | null): string {
  if (type === 'standard') return 'Toyota RAV4 / Corolla or similar';
  if (type === '8_seater' || type === '8-seater') return 'Mercedes Vito or similar';
  return '';
}
