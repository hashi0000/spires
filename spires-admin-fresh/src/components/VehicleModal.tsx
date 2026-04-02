// components/VehicleModal.tsx
import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types/types';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  editingVehicle?: Vehicle | null;
}

const VehicleModal: React.FC<VehicleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingVehicle
}) => {
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    registration: '',
    make: '',
    model: '',
    year: '',
    color: '',
    available: true,
    notes: ''
  });

  useEffect(() => {
    if (editingVehicle) {
      setFormData(editingVehicle);
    } else {
      setFormData({
        registration: '',
        make: '',
        model: '',
        year: '',
        color: '',
        available: true,
        notes: ''
      });
    }
  }, [editingVehicle, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as Omit<Vehicle, 'id' | 'createdAt'>);
    onClose();
  };

  const handleClose = () => {
    setFormData({
      registration: '',
      make: '',
      model: '',
      year: '',
      color: '',
      available: true,
      notes: ''
    });
    onClose();
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
            background: 'linear-gradient(to right, #059669, #047857)'
          }}
        >
          <h3 className="text-lg font-medium">
            {editingVehicle ? '✏️ Edit Vehicle' : '🚗 Add New Vehicle'}
          </h3>
          <p className="text-green-100 text-sm mt-1">
            {editingVehicle ? 'Update vehicle information' : 'Add a new vehicle to your fleet'}
          </p>
        </div>
        
        {/* Form Content */}
        <div style={{ maxHeight: 'calc(90vh - 160px)', overflowY: 'auto' }}>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration *</label>
              <input
                type="text"
                value={formData.registration || ''}
                onChange={(e) => setFormData({...formData, registration: e.target.value.toUpperCase()})}
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
                  onChange={(e) => setFormData({...formData, make: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, year: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  placeholder="2023"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color *</label>
                <input
                  type="text"
                  value={formData.color || ''}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className="w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                  placeholder="White"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, available: e.target.checked})}
                  className="mr-3 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  ✅ Available for bookings
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Uncheck if vehicle is being serviced or unavailable
              </p>
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
                  background: 'linear-gradient(to right, #059669, #047857)',
                  transition: 'all 0.2s'
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