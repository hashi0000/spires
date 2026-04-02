// components/DriverModal.tsx - REPLACE your DriverModal with this fixed version
import React, { useState, useEffect } from 'react';
import { Driver } from '../types/types';

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (driver: Omit<Driver, 'id' | 'createdAt'>) => void;
  editingDriver?: Driver | null;
  isAtLimit: boolean;
}

const DriverModal: React.FC<DriverModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingDriver,
  isAtLimit
}) => {
  const [formData, setFormData] = useState<Partial<Driver>>({
    name: '',
    licenseNumber: '',
    phoneNumber: '',
    email: '',
    active: false,
    licenseExpiry: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    if (editingDriver) {
      setFormData(editingDriver);
    } else {
      setFormData({
        name: '',
        licenseNumber: '',
        phoneNumber: '',
        email: '',
        active: false,
        licenseExpiry: '',
        address: '',
        notes: ''
      });
    }
  }, [editingDriver, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.active && !editingDriver?.active && isAtLimit) {
      alert('Maximum 3 active drivers allowed by Oxford City Council.');
      return;
    }

    onSubmit(formData as Omit<Driver, 'id' | 'createdAt'>);
    onClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      licenseNumber: '',
      phoneNumber: '',
      email: '',
      active: false,
      licenseExpiry: '',
      address: '',
      notes: ''
    });
    onClose();
  };

  // DON'T RENDER ANYTHING IF NOT OPEN
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
        padding: '16px'
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto"
        style={{
          maxHeight: '90vh',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div 
          className="p-6 text-white rounded-t-lg"
          style={{
            background: 'linear-gradient(to right, #2563eb, #1d4ed8)'
          }}
        >
          <h3 className="text-lg font-medium">
            {editingDriver ? '✏️ Edit Driver' : '➕ Add New Driver'}
          </h3>
          <p className="text-blue-100 text-sm mt-1">
            {editingDriver ? 'Update driver information' : 'Add a new driver to your fleet'}
          </p>
        </div>
        
        {/* Form Content */}
        <div style={{ maxHeight: 'calc(90vh - 160px)', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter full name"
                  required
                  style={{ transition: 'all 0.2s' }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">License Number *</label>
                <input
                  type="text"
                  value={formData.licenseNumber || ''}
                  onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., OX123456"
                  required
                  style={{ transition: 'all 0.2s' }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="07XXXXXXXXX"
                    required
                    style={{ transition: 'all 0.2s' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">License Expiry *</label>
                  <input
                    type="date"
                    value={formData.licenseExpiry || ''}
                    onChange={(e) => setFormData({...formData, licenseExpiry: e.target.value})}
                    className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    style={{ transition: 'all 0.2s' }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="driver@example.com"
                  required
                  style={{ transition: 'all 0.2s' }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full address (optional)"
                  rows={2}
                  style={{ transition: 'all 0.2s' }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional notes (optional)"
                  rows={2}
                  style={{ transition: 'all 0.2s' }}
                />
              </div>
              
              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: '#f9fafb' }}
              >
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active || false}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="mr-3 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    disabled={!editingDriver && formData.active && isAtLimit}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active Driver {!editingDriver && isAtLimit && '(⚠️ Limit: 3/3)'}
                  </span>
                </label>
                {!editingDriver && isAtLimit && (
                  <p className="text-xs text-red-600 mt-1">
                    Maximum 3 active drivers allowed by Oxford City Council
                  </p>
                )}
              </div>
            </div>
            
            {/* Footer */}
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
                  background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #1d4ed8, #1e40af)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)';
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