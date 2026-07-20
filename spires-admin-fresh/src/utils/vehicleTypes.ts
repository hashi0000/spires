export const VEHICLE_TYPE_OPTIONS = [
  { value: 'standard' as const, label: 'Standard car (up to 4)' },
  { value: '8_seater' as const, label: '8-seater (up to 8)' },
];

export type VehicleTypeOption = 'standard' | '8_seater';

export function formatVehicleTypeLabel(type?: string | null): string {
  if (!type) return 'Not specified';
  if (type === '8_seater' || type === '8-seater') return '8-seater';
  if (type === 'standard') return 'Standard car';
  return type.replace(/_/g, ' ');
}
