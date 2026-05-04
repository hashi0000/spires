import React, { useState, useEffect } from 'react';
import { Driver } from '../types/types';
import { getExpiryStatus, expiryStatusLabel, expiryStatusClass } from '../utils/driverExpiry';
import {
  uploadDriverComplianceDocument,
  validateDriverUploadFile,
  firestoreUrlKeyForDriverDocumentSlot,
  type DriverDocumentSlot,
} from '../utils/driverDocumentUpload';

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (driver: Omit<Driver, 'id' | 'createdAt'>) => void;
  editingDriver?: Driver | null;
  isAtLimit: boolean;
}

const emptyForm = (): Partial<Driver> => ({
  name: '',
  licenseNumber: '',
  phoneNumber: '',
  email: '',
  active: false,
  licenseExpiry: '',
  address: '',
  notes: '',
  licensing: { badgeNumber: '', badgeExpiry: '' },
  compliance: { dbsExpiry: '', safeguardingExpiry: '' },
  isSchoolApproved: false,
  documents: {},
});

function ExpiryStatusBadge({ value }: { value?: string }) {
  const status = getExpiryStatus(value);
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${expiryStatusClass(status)}`}>
      {expiryStatusLabel(status)}
    </span>
  );
}

const DriverModal: React.FC<DriverModalProps> = ({ isOpen, onClose, onSubmit, editingDriver, isAtLimit }) => {
  const [formData, setFormData] = useState<Partial<Driver>>(emptyForm);
  const [uploading, setUploading] = useState<DriverDocumentSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingDriver) {
      setFormData({
        ...editingDriver,
        licensing: {
          badgeNumber: editingDriver.licensing?.badgeNumber ?? '',
          badgeExpiry: editingDriver.licensing?.badgeExpiry ?? '',
        },
        compliance: {
          dbsExpiry: editingDriver.compliance?.dbsExpiry ?? '',
          safeguardingExpiry: editingDriver.compliance?.safeguardingExpiry ?? '',
        },
        documents: { ...editingDriver.documents },
        isSchoolApproved: editingDriver.isSchoolApproved === true,
      });
    } else {
      setFormData(emptyForm());
    }
    setUploadError(null);
    setUploading(null);
  }, [editingDriver, isOpen]);

  const driverId = editingDriver?.id;

  const handleFile = async (slot: DriverDocumentSlot, fileList: FileList | null) => {
    setUploadError(null);
    if (!driverId) {
      setUploadError('Save the driver first, then upload documents from edit.');
      return;
    }
    const file = fileList?.[0];
    if (!file) return;
    const localErr = validateDriverUploadFile(file);
    if (localErr) {
      setUploadError(localErr);
      return;
    }
    setUploading(slot);
    try {
      const url = await uploadDriverComplianceDocument(driverId, slot, file);
      const urlKey = firestoreUrlKeyForDriverDocumentSlot(slot);
      setFormData((prev) => ({
        ...prev,
        documents: { ...prev.documents, [urlKey]: url },
      }));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.active && !editingDriver?.active && isAtLimit) {
      alert('Maximum 3 active drivers allowed by Oxford City Council.');
      return;
    }

    const payload: Omit<Driver, 'id' | 'createdAt'> = {
      name: formData.name ?? '',
      licenseNumber: formData.licenseNumber ?? '',
      phoneNumber: formData.phoneNumber ?? '',
      email: formData.email ?? '',
      active: Boolean(formData.active),
      licenseExpiry: formData.licenseExpiry ?? '',
      address: formData.address ?? '',
      notes: formData.notes ?? '',
      isSchoolApproved: formData.isSchoolApproved === true,
      licensing: {
        badgeNumber: formData.licensing?.badgeNumber ?? '',
        badgeExpiry: formData.licensing?.badgeExpiry ?? '',
      },
      compliance: {
        dbsExpiry: formData.compliance?.dbsExpiry ?? '',
        safeguardingExpiry: formData.compliance?.safeguardingExpiry ?? '',
      },
    };

    onSubmit(payload);
    onClose();
  };

  const handleClose = () => {
    setFormData(emptyForm());
    setUploadError(null);
    setUploading(null);
    onClose();
  };

  const docUrl = (key: 'driverLicenceUrl' | 'privateHireLicenceUrl' | 'motDocumentUrl') =>
    formData.documents?.[key];

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
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-auto"
        style={{
          maxHeight: '90vh',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className="p-6 text-white rounded-t-lg"
          style={{
            background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
          }}
        >
          <h3 className="text-lg font-medium">{editingDriver ? '✏️ Edit Driver' : '➕ Add New Driver'}</h3>
          <p className="text-blue-100 text-sm mt-1">
            {editingDriver ? 'Update driver information' : 'Add a new driver to your fleet'}
          </p>
        </div>

        <div style={{ maxHeight: 'calc(90vh - 160px)', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">License Number *</label>
                <input
                  type="text"
                  value={formData.licenseNumber || ''}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., OX123456"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="07XXXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Expiry *</label>
                  <input
                    type="date"
                    value={formData.licenseExpiry || ''}
                    onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="driver@example.com"
                  required
                />
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Licensing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Badge number</label>
                    <input
                      type="text"
                      value={formData.licensing?.badgeNumber ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          licensing: { ...formData.licensing, badgeNumber: e.target.value, badgeExpiry: formData.licensing?.badgeExpiry ?? '' },
                        })
                      }
                      className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.licensing?.badgeExpiry ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            licensing: {
                              badgeNumber: formData.licensing?.badgeNumber ?? '',
                              badgeExpiry: e.target.value,
                            },
                          })
                        }
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ExpiryStatusBadge value={formData.licensing?.badgeExpiry} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Compliance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DBS expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.compliance?.dbsExpiry ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            compliance: {
                              dbsExpiry: e.target.value,
                              safeguardingExpiry: formData.compliance?.safeguardingExpiry ?? '',
                            },
                          })
                        }
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ExpiryStatusBadge value={formData.compliance?.dbsExpiry} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Safeguarding expiry</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={formData.compliance?.safeguardingExpiry ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            compliance: {
                              dbsExpiry: formData.compliance?.dbsExpiry ?? '',
                              safeguardingExpiry: e.target.value,
                            },
                          })
                        }
                        className="flex-1 min-w-[140px] p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <ExpiryStatusBadge value={formData.compliance?.safeguardingExpiry} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isSchoolApproved === true}
                    onChange={(e) => setFormData({ ...formData, isSchoolApproved: e.target.checked })}
                    className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">School approved</span>
                </label>
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-4">
                <p className="text-sm font-semibold text-gray-800">Documents</p>
                {!driverId && (
                  <p className="text-xs text-gray-500">Create the driver, then open edit to upload files (PDF, JPG, PNG — max 5MB).</p>
                )}
                {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Driver licence upload</label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {docUrl('driverLicenceUrl') ? (
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => window.open(docUrl('driverLicenceUrl'), '_blank', 'noopener,noreferrer')}
                      >
                        View document
                      </button>
                    ) : (
                      <span className="text-gray-500">No file yet</span>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      disabled={!driverId || uploading !== null}
                      className="text-sm max-w-full"
                      onChange={(e) => {
                        void handleFile('driverLicence', e.target.files);
                        e.target.value = '';
                      }}
                    />
                    {uploading === 'driverLicence' && <span className="text-gray-500">Uploading…</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Private hire licence upload</label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {docUrl('privateHireLicenceUrl') ? (
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => window.open(docUrl('privateHireLicenceUrl'), '_blank', 'noopener,noreferrer')}
                      >
                        View document
                      </button>
                    ) : (
                      <span className="text-gray-500">No file yet</span>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      disabled={!driverId || uploading !== null}
                      className="text-sm max-w-full"
                      onChange={(e) => {
                        void handleFile('privateHireLicence', e.target.files);
                        e.target.value = '';
                      }}
                    />
                    {uploading === 'privateHireLicence' && <span className="text-gray-500">Uploading…</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">MOT certificate upload</label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {docUrl('motDocumentUrl') ? (
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => window.open(docUrl('motDocumentUrl'), '_blank', 'noopener,noreferrer')}
                      >
                        View document
                      </button>
                    ) : (
                      <span className="text-gray-500">No file yet</span>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      disabled={!driverId || uploading !== null}
                      className="text-sm max-w-full"
                      onChange={(e) => {
                        void handleFile('mot', e.target.files);
                        e.target.value = '';
                      }}
                    />
                    {uploading === 'mot' && <span className="text-gray-500">Uploading…</span>}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full address (optional)"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional notes (optional)"
                  rows={2}
                />
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active || false}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={!editingDriver && formData.active && isAtLimit}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active Driver {!editingDriver && isAtLimit && '(⚠️ Limit: 3/3)'}
                  </span>
                </label>
                {!editingDriver && isAtLimit && (
                  <p className="text-xs text-red-600 mt-1">Maximum 3 active drivers allowed by Oxford City Council</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t" style={{ backgroundColor: '#f9fafb' }}>
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 text-white rounded-lg font-medium shadow-lg"
                style={{
                  background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
                }}
              >
                {editingDriver ? '✓ Update Driver' : '➕ Add Driver'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DriverModal;
