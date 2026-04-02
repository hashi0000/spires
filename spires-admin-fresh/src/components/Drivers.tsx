// components/Drivers.tsx
import React from 'react';
import { Plus, Edit3, Trash2, CheckCircle, XCircle, Users } from 'lucide-react';
import { Driver } from '../types/types';

interface DriversProps {
  drivers: Driver[];
  activeCount: number;
  isAtLimit: boolean;
  remainingSlots: number;
  onAddDriver: () => void;
  onEditDriver: (driver: Driver) => void;
  onDeleteDriver: (id: string, name: string) => void;
}

const Drivers: React.FC<DriversProps> = ({
  drivers,
  activeCount,
  isAtLimit,
  remainingSlots,
  onAddDriver,
  onEditDriver,
  onDeleteDriver
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
            <p className={`text-2xl font-bold ${isAtLimit ? 'text-red-600' : 'text-green-600'}`}>
              {activeCount}/3
            </p>
            <p className="text-sm text-gray-600">{remainingSlots} slots available</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-md">
        {drivers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No drivers added yet</h3>
            <button 
              onClick={onAddDriver} 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Your First Driver
            </button>
          </div>
        ) : (
          <div>
            {drivers.map((driver) => (
              <div key={driver.id} className="px-6 py-4 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {driver.active ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">{driver.name}</h3>
                        {driver.active && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">License: {driver.licenseNumber}</p>
                      <p className="text-sm text-gray-500">📞 {driver.phoneNumber} | ✉️ {driver.email}</p>
                      <p className="text-sm text-gray-500">
                        📅 Expires: {new Date(driver.licenseExpiry).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => onEditDriver(driver)} 
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => onDeleteDriver(driver.id!, driver.name)} 
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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