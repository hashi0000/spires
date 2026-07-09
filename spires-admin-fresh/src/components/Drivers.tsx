import React, { useMemo, useState } from 'react';
import { Plus, Edit3, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { Driver } from '../types/types';
import { getExpiryStatus, getDbsExpiryStatus, expiryStatusLabel, dbsExpiryStatusLabel } from '../utils/driverExpiry';

interface DriversProps {
  drivers: Driver[];
  activeCount: number;
  isAtLimit: boolean;
  remainingSlots: number;
  onAddDriver: () => void;
  onEditDriver: (driver: Driver) => void;
  onDeleteDriver: (id: string, name: string) => void;
}

function sortDrivers(drivers: Driver[]): Driver[] {
  return [...drivers].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function formatExpiry(value?: string): string {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDbsExpiry(driver: Driver): string {
  if (driver.compliance?.dbsUpdateService) {
    return driver.compliance?.dbsExpiry
      ? formatExpiry(driver.compliance.dbsExpiry)
      : 'Update Service';
  }
  return formatExpiry(driver.compliance?.dbsExpiry);
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

function DocLink({ url }: { url?: string }) {
  if (url && url.length > 0) {
    return (
      <button
        type="button"
        className="doc-link"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      >
        View
      </button>
    );
  }
  return <span className="doc-link--missing">Missing</span>;
}

const Drivers: React.FC<DriversProps> = ({
  drivers,
  activeCount,
  isAtLimit,
  remainingSlots,
  onAddDriver,
  onEditDriver,
  onDeleteDriver,
}) => {
  const [hideInactive, setHideInactive] = useState(true);

  const inactiveCount = useMemo(() => drivers.filter((d) => !d.active).length, [drivers]);

  const displayedDrivers = useMemo(() => {
    const sorted = sortDrivers(drivers);
    return hideInactive ? sorted.filter((d) => d.active) : sorted;
  }, [drivers, hideInactive]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Drivers</h2>
          {drivers.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {activeCount} active
              {inactiveCount > 0 && ` · ${inactiveCount} inactive`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {inactiveCount > 0 && (
            <button
              type="button"
              onClick={() => setHideInactive((prev) => !prev)}
              className="btn btn-secondary"
            >
              {hideInactive ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {hideInactive ? `Show ${inactiveCount} inactive` : 'Hide inactive'}
            </button>
          )}
          <button onClick={onAddDriver} className="btn btn-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Driver
          </button>
        </div>
      </div>

      <div className="driver-limit-card">
        <div>
          <h3 className="driver-limit-card__title">Driver limit</h3>
          <p className="driver-limit-card__subtitle">
            Oxford City Council allows a maximum of 3 active drivers
          </p>
        </div>
        <div className="driver-limit-card__count">
          <p
            className={`driver-limit-card__number ${
              isAtLimit ? 'driver-limit-card__number--full' : 'driver-limit-card__number--ok'
            }`}
          >
            {activeCount}/3
          </p>
          <p className="driver-limit-card__slots">{remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      {drivers.length === 0 ? (
        <div className="card text-center">
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers added yet</h3>
          <button onClick={onAddDriver} className="btn btn-primary mt-2">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Driver
          </button>
        </div>
      ) : displayedDrivers.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-700 font-medium">No active drivers</p>
          <button
            type="button"
            onClick={() => setHideInactive(false)}
            className="btn btn-secondary mt-3"
          >
            Show inactive drivers
          </button>
        </div>
      ) : (
        <ul className="driver-list">
          {displayedDrivers.map((driver) => (
            <li key={driver.id}>
              <article className={`driver-card${driver.active ? '' : ' driver-card--inactive'}`}>
                <div className="driver-card-main">
                  <div
                    className={`driver-identity${driver.active ? '' : ' driver-identity--inactive'}`}
                  >
                    <span className="driver-identity__label">Driver</span>
                    <span className="driver-identity__name">{driver.name}</span>
                    <div className="driver-identity__badges">
                      <span
                        className={`driver-identity__status ${
                          driver.active
                            ? 'driver-identity__status--active'
                            : 'driver-identity__status--inactive'
                        }`}
                      >
                        {driver.active ? 'Active' : 'Inactive'}
                      </span>
                      {driver.isSchoolApproved === true && (
                        <span className="driver-identity__school">School approved</span>
                      )}
                    </div>
                  </div>

                  <div className="driver-card-body">
                    <div className="driver-card-top">
                      <div className="driver-details-grid">
                        <div>
                          <p className="driver-field__label">Phone</p>
                          <p className="driver-field__value">{driver.phoneNumber || '—'}</p>
                        </div>
                        <div>
                          <p className="driver-field__label">Email</p>
                          <p className="driver-field__value driver-field__value--muted">
                            {driver.email || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="driver-field__label">Licence no.</p>
                          <p className="driver-field__value">
                            {driver.licenseNumber?.trim() || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="driver-field__label">Licence expiry</p>
                          <p className="driver-field__value">{formatExpiry(driver.licenseExpiry)}</p>
                          {driver.licenseExpiry ? (
                            <span className={expiryTagClass(getExpiryStatus(driver.licenseExpiry))}>
                              {expiryStatusLabel(getExpiryStatus(driver.licenseExpiry))}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="driver-card-actions">
                        <button
                          type="button"
                          onClick={() => onEditDriver(driver)}
                          className="btn btn-primary btn-sm"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDriver(driver.id!, driver.name)}
                          className="btn btn-danger btn-sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {driver.address?.trim() ? (
                      <p className="driver-notes">
                        <strong>Address:</strong> {driver.address.trim()}
                      </p>
                    ) : null}
                    {driver.notes?.trim() ? (
                      <p className="driver-notes">{driver.notes.trim()}</p>
                    ) : null}
                  </div>
                </div>

                <div className="driver-compliance">
                  <p className="driver-compliance__title">Compliance</p>
                  <div className="driver-compliance-grid">
                    <div className="driver-compliance-item">
                      <p className="driver-compliance-item__label">Badge</p>
                      {driver.licensing?.badgeNumber?.trim() ? (
                        <p className="driver-compliance-item__date">{driver.licensing.badgeNumber.trim()}</p>
                      ) : null}
                      <p className="driver-compliance-item__date">
                        {formatExpiry(driver.licensing?.badgeExpiry)}
                      </p>
                      <span className={expiryTagClass(getExpiryStatus(driver.licensing?.badgeExpiry))}>
                        {expiryStatusLabel(getExpiryStatus(driver.licensing?.badgeExpiry))}
                      </span>
                    </div>
                    <div className="driver-compliance-item">
                      <p className="driver-compliance-item__label">DBS</p>
                      <p className="driver-compliance-item__date">
                        {formatDbsExpiry(driver)}
                      </p>
                      <span
                        className={expiryTagClass(
                          getDbsExpiryStatus(driver.compliance?.dbsExpiry, driver.compliance?.dbsUpdateService)
                        )}
                      >
                        {dbsExpiryStatusLabel(
                          getDbsExpiryStatus(driver.compliance?.dbsExpiry, driver.compliance?.dbsUpdateService),
                          driver.compliance?.dbsUpdateService
                        )}
                      </span>
                    </div>
                    <div className="driver-compliance-item">
                      <p className="driver-compliance-item__label">Safeguarding</p>
                      <p className="driver-compliance-item__date">
                        {formatExpiry(driver.compliance?.safeguardingExpiry)}
                      </p>
                      <span
                        className={expiryTagClass(getExpiryStatus(driver.compliance?.safeguardingExpiry))}
                      >
                        {expiryStatusLabel(getExpiryStatus(driver.compliance?.safeguardingExpiry))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="driver-documents">
                  <p className="driver-documents__title">Documents</p>
                  <div className="driver-documents-grid">
                    <div className="driver-document-item">
                      <span className="driver-document-item__label">Driver licence</span>
                      <DocLink url={driver.documents?.driverLicenceUrl} />
                    </div>
                    <div className="driver-document-item">
                      <span className="driver-document-item__label">PH licence</span>
                      <DocLink url={driver.documents?.privateHireLicenceUrl} />
                    </div>
                    <div className="driver-document-item">
                      <span className="driver-document-item__label">MOT</span>
                      <DocLink url={driver.documents?.motDocumentUrl} />
                    </div>
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

export default Drivers;
