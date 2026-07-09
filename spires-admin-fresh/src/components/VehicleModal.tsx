// components/VehicleModal.tsx
import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types/types';
import { getExpiryStatus, expiryStatusLabel, expiryStatusClass } from '../utils/driverExpiry';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  editingVehicle?: Vehicle | null;
}

const emptyForm = (): Partial<Vehicle> => ({
  registration: '',
  make: '',
  model: '',
  year: '',
  color: '',
  available: true,
  notes: '',
  seats: undefined,
  compliance: {
    motExpiry: '',
    insuranceExpiry: '',
    phLicenceExpiry: '',
    taxExpiry: '',
  },
});

function ExpiryStatusBadge({ value }: { value?: string }) {
  const status = getExpiryStatus(value);
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${expiryStatusClass(status)}`}>
      {expiryStatusLabel(status)}
    </span>
  );
}

const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingVehicle,
}) => {
  const [formData, setFormData] = useState<Partial<Vehicle>>(emptyForm());

  useEffect(() => {
    if (!isOpen) return;
    if (editingVehicle) {
      setFormData({
        ...editingVehicle,
        compliance: {
          motExpiry: editingVehicle.compliance?.motExpiry ?? '',
          insuranceExpiry: editingVehicle.compliance?.insuranceExpiry ?? '',
          phLicenceExpiry: editingVehicle.compliance?.phLicenceExpiry ?? '',
          taxExpiry: editingVehicle.compliance?.taxExpiry ?? '',
        },
      });
    } else {
      setFormData(emptyForm());
    }
  }, [editingVehicle, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as Omit<Vehicle, 'id' | 'createdAt'>);
    onClose();
  };

  const handleClose = () => {
    setFormData(emptyForm());
    onClose();
  };

  const updateCompliance = (field: keyof NonNullable<Vehicle['compliance']>, value: string) => {
    setFormData({
      ...formData,
      compliance: {
        motExpiry: formData.compliance?.motExpiry ?? '',
        insuranceExpiry: formData.compliance?.insuranceExpiry ?? '',
        phLicenceExpiry: formData.compliance?.phLicenceExpiry ?? '',
        taxExpiry: formData.compliance?.taxExpiry ?? '',
        [field]: value,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto"
        style={{
          maxHeight: '90vh',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className="p-6 text-white rounded-t-lg"
          style={{
            background: 'linear-gradient(to right, #059669, #047857)',
          }}
        >
          <h3 className="text-lg font-medium">
            {editingVehicle ? '✏️ Edit Vehicle' : '🚗 Add New Vehicle'}
          </h3>
          <p className="text-green-100 text-sm mt-1">
            {editingVehicle ? 'Update vehicle information' : 'Add a new vehicle to your fleet'}
          </p>
        </div>

        <div style={{ maxHeight: 'calc(90vh - 160px)', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration *</label>
                <input
                  type="text"
                  value={formData.registration || ''}
                  onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                  className="w-full p-3 border-2 rounded-lg uppercase focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  placeholder="AB12 CDE"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Make *</label>
                  <input
                    type="text"
                    value={formData.make || ''}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    placeholder="Toyota"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model *</label>
                  <input
                    type="text"
                    value={formData.model || ''}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    placeholder="Prius"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year *</label>
                  <input
                    type="text"
                    value={formData.year || ''}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    placeholder="2023"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Colour *</label>
                  <input
                    type="text"
                    value={formData.color || ''}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                    placeholder="White"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Passenger seats</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.seats ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      seats: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  placeholder="e.g. 4"
                />
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Compliance & expiry dates</p>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">MOT expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.compliance?.motExpiry ?? ''}
                        onChange={(e) => updateCompliance('motExpiry', e.target.value)}
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <ExpiryStatusBadge value={formData.compliance?.motExpiry} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Insurance expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.compliance?.insuranceExpiry ?? ''}
                        onChange={(e) => updateCompliance('insuranceExpiry', e.target.value)}
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <ExpiryStatusBadge value={formData.compliance?.insuranceExpiry} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PH vehicle licence expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.compliance?.phLicenceExpiry ?? ''}
                        onChange={(e) => updateCompliance('phLicenceExpiry', e.target.value)}
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <ExpiryStatusBadge value={formData.compliance?.phLicenceExpiry} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Road tax expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.compliance?.taxExpiry ?? ''}
                        onChange={(e) => updateCompliance('taxExpiry', e.target.value)}
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <ExpiryStatusBadge value={formData.compliance?.taxExpiry} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  rows={2}
                  placeholder="Any additional notes about this vehicle"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.available || false}
                    onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                    className="mr-3 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Available for bookings</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Uncheck if the vehicle is off fleet, being serviced, or otherwise not available
                </p>
              </div>
            </div>

            <div
              className="flex justify-end gap-3 p-6 border-t"
              style={{ backgroundColor: '#f9fafb' }}
            >
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 font-medium"
                style={{ transition: 'all 0.2s' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 text-white rounded-lg font-medium shadow-lg"
                style={{
                  background: 'linear-gradient(to right, #059669, #047857)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #047857, #065f46)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)';
                }}
              >
                {editingVehicle ? '✓ Update Vehicle' : '🚗 Add Vehicle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VehicleModal;
