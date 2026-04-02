// components/Vehicles.tsx
import React from 'react';
import { Plus, Edit3, Trash2, CheckCircle, XCircle, Car } from 'lucide-react';
import { Vehicle } from '../types/types';

interface VehiclesProps {
  vehicles: Vehicle[];
  onAddVehicle: () => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (id: string, registration: string) => void;
}

const Vehicles: React.FC<VehiclesProps> = ({
  vehicles,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Vehicles</h2>
        <button 
          onClick={onAddVehicle} 
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden rounded-md">
        {vehicles.length === 0 ? (
          <div className="text-center py-12">
            <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles added yet</h3>
            <button 
              onClick={onAddVehicle} 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add Your First Vehicle
            </button>
          </div>
        ) : (
          <div>
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="px-6 py-4 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {vehicle.available ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-medium text-gray-900">{vehicle.registration}</h3>
                        {vehicle.available ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                            Available
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                            In Use
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-600">
                        {vehicle.make} {vehicle.model} ({vehicle.year})
                      </p>
                      <p className="text-sm text-gray-500">Color: {vehicle.color}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => onEditVehicle(vehicle)} 
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => onDeleteVehicle(vehicle.id!, vehicle.registration)} 
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

export default Vehicles;