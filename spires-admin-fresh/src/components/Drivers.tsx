import React from 'react';
import { Plus, Edit3, Trash2, CheckCircle, XCircle, Users } from 'lucide-react';
import { Driver } from '../types/types';
import { getExpiryStatus, expiryStatusLabel, expiryStatusClass } from '../utils/driverExpiry';

interface DriversProps {
  drivers: Driver[];
  activeCount: number;
  isAtLimit: boolean;
  remainingSlots: number;
  onAddDriver: () => void;
  onEditDriver: (driver: Driver) => void;
  onDeleteDriver: (id: string, name: string) => void;
}

function DocLink({ url }: { url?: string }) {
  if (url && url.length > 0) {
    return (
      <button
        type="button"
        className="text-blue-600 hover:underline text-sm"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      >
        View
      </button>
    );
  }
  return <span className="text-gray-400 text-sm">Missing</span>;
}

function MiniExpiry({ label, value }: { label: string; value?: string }) {
  const s = getExpiryStatus(value);
  return (
    <span className="inline-flex items-center gap-1 mr-2 mb-1">
      <span className="text-gray-500">{label}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${expiryStatusClass(s)}`}>{expiryStatusLabel(s)}</span>
    </span>
  );
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
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Drivers</h2>
        <button
          onClick={onAddDriver}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Driver
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Driver Limit Status</h3>
            <p className="text-sm text-gray-600">Oxford City Council allows maximum 3 active drivers</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${isAtLimit ? 'text-red-600' : 'text-green-600'}`}>{activeCount}/3</p>
            <p className="text-sm text-gray-600">{remainingSlots} slots available</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-md">
        {drivers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers added yet</h3>
            <button onClick={onAddDriver} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Add Your First Driver
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {drivers.map((driver) => (
              <div key={driver.id} className="px-4 sm:px-6 py-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="flex-shrink-0 pt-1">
                      {driver.active ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">{driver.name}</h3>
                        {driver.licenseNumber?.trim() ? (
                          <span className="text-sm text-gray-500 shrink-0" title="Taxi / PH licence no.">
                            · {driver.licenseNumber.trim()}
                          </span>
                        ) : null}
                        {driver.active && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Active</span>
                        )}
                        {driver.isSchoolApproved === true && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">School</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {driver.phoneNumber} · {driver.email}
                      </p>
                      {driver.licenseExpiry ? (
                        <p className="text-sm text-gray-500">Licence expires: {new Date(driver.licenseExpiry).toLocaleDateString('en-GB')}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap">
                        <MiniExpiry label="Badge" value={driver.licensing?.badgeExpiry} />
                        <MiniExpiry label="DBS" value={driver.compliance?.dbsExpiry} />
                        <MiniExpiry label="SG" value={driver.compliance?.safeguardingExpiry} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 lg:gap-8 flex-shrink-0">
                    <div className="text-sm">
                      <p className="font-medium text-gray-700 mb-1">Documents</p>
                      <ul className="space-y-1 text-gray-600">
                        <li className="flex items-center gap-2">
                          <span className="text-gray-500 w-28 shrink-0">Driver licence</span>
                          <DocLink url={driver.documents?.driverLicenceUrl} />
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-gray-500 w-28 shrink-0">PH licence</span>
                          <DocLink url={driver.documents?.privateHireLicenceUrl} />
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-gray-500 w-28 shrink-0">MOT</span>
                          <DocLink url={driver.documents?.motDocumentUrl} />
                        </li>
                      </ul>
                    </div>
                    <div className="flex items-center space-x-2 self-end sm:self-start">
                      <button
                        onClick={() => onEditDriver(driver)}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        aria-label="Edit driver"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteDriver(driver.id!, driver.name)}
                        className="text-red-600 hover:text-red-800 p-2"
                        aria-label="Delete driver"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drivers;
