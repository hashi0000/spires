// components/Vehicles.tsx
import React, { useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, Car, Eye, EyeOff } from 'lucide-react';
import { Vehicle } from '../types/types';
import { getExpiryStatus, expiryStatusLabel } from '../utils/driverExpiry';

interface VehiclesProps {
  vehicles: Vehicle[];
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (id: string, registration: string) => void;
}

function sortVehicles(vehicles: Vehicle[]): Vehicle[] {
  return [...vehicles].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.registration.localeCompare(b.registration, undefined, { sensitivity: 'base' });
  });
}

function formatExpiry(value?: string): string {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function expiryTagClass(status: ReturnType<typeof getExpiryStatus>): string {
  switch (status) {
    case 'valid':
      return 'expiry-tag expiry-tag--valid';
    case 'warning':
      return 'expiry-tag expiry-tag--warning';
    case 'expired':
      return 'expiry-tag expiry-tag--expired';
    default:
      return 'expiry-tag expiry-tag--missing';
  }
}

const Vehicles: React.FC<VehiclesProps> = ({
  vehicles,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
}) => {
  const [hideUnavailable, setHideUnavailable] = useState(true);

  const availableCount = useMemo(() => vehicles.filter((v) => v.available).length, [vehicles]);
  const unavailableCount = vehicles.length - availableCount;

  const displayedVehicles = useMemo(() => {
    const sorted = sortVehicles(vehicles);
    return hideUnavailable ? sorted.filter((v) => v.available) : sorted;
  }, [vehicles, hideUnavailable]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vehicles</h2>
          {vehicles.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {availableCount} available
              {unavailableCount > 0 && ` · ${unavailableCount} off fleet`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {unavailableCount > 0 && (
            <button
              type="button"
              onClick={() => setHideUnavailable((prev) => !prev)}
              className="btn btn-secondary"
            >
              {hideUnavailable ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {hideUnavailable ? `Show ${unavailableCount} off fleet` : 'Hide off fleet'}
            </button>
          )}
          <button onClick={onAddVehicle} className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="card text-center">
          <Car className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles added yet</h3>
          <button onClick={onAddVehicle} className="btn btn-primary mt-2">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Vehicle
          </button>
        </div>
      ) : displayedVehicles.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-700 font-medium">No available vehicles</p>
          <button
            type="button"
            onClick={() => setHideUnavailable(false)}
            className="btn btn-secondary mt-3"
          >
            Show off-fleet vehicles
          </button>
        </div>
      ) : (
        <ul className="vehicle-list">
          {displayedVehicles.map((vehicle) => (
            <li key={vehicle.id}>
              <article
                className={`vehicle-card${vehicle.available ? '' : ' vehicle-card--off-fleet'}`}
              >
                <div className="vehicle-card-main">
                  <div
                    className={`vehicle-plate${vehicle.available ? '' : ' vehicle-plate--off'}`}
                  >
                    <span className="vehicle-plate__label">Registration</span>
                    <span className="vehicle-plate__reg">{vehicle.registration}</span>
                    <span
                      className={`vehicle-plate__status ${
                        vehicle.available
                          ? 'vehicle-plate__status--available'
                          : 'vehicle-plate__status--off'
                      }`}
                    >
                      {vehicle.available ? 'Available' : 'Off fleet'}
                    </span>
                  </div>

                  <div className="vehicle-card-body">
                    <div className="vehicle-card-top">
                      <div className="vehicle-details-grid">
                        <div>
                          <p className="vehicle-field__label">Make &amp; model</p>
                          <p className="vehicle-field__value">
                            {vehicle.make} {vehicle.model}
                          </p>
                        </div>
                        <div>
                          <p className="vehicle-field__label">Year</p>
                          <p className="vehicle-field__value">{vehicle.year}</p>
                        </div>
                        <div>
                          <p className="vehicle-field__label">Colour</p>
                          <p className="vehicle-field__value">{vehicle.color}</p>
                        </div>
                        <div>
                          <p className="vehicle-field__label">Seats</p>
                          <p className="vehicle-field__value">
                            {typeof vehicle.seats === 'number' && vehicle.seats > 0
                              ? vehicle.seats
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="vehicle-card-actions">
                        <button
                          type="button"
                          onClick={() => onEditVehicle(vehicle)}
                          className="btn btn-primary btn-sm"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteVehicle(vehicle.id!, vehicle.registration)}
                          className="btn btn-danger btn-sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {vehicle.notes?.trim() ? (
                      <p className="vehicle-notes">{vehicle.notes.trim()}</p>
                    ) : null}
                  </div>
                </div>

                <div className="vehicle-compliance">
                  <p className="vehicle-compliance__title">Compliance</p>
                  <div className="vehicle-compliance-grid">
                    {(
                      [
                        ['MOT', vehicle.compliance?.motExpiry],
                        ['Insurance', vehicle.compliance?.insuranceExpiry],
                        ['PH licence', vehicle.compliance?.phLicenceExpiry],
                        ['Road tax', vehicle.compliance?.taxExpiry],
                      ] as const
                    ).map(([label, value]) => {
                      const status = getExpiryStatus(value);
                      return (
                        <div key={label} className="vehicle-compliance-item">
                          <p className="vehicle-compliance-item__label">{label}</p>
                          <p className="vehicle-compliance-item__date">{formatExpiry(value)}</p>
                          <span className={expiryTagClass(status)}>{expiryStatusLabel(status)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Vehicles;
