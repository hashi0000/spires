// Dashboard.tsx - Put this in a separate file
import React from 'react';
import { Users, Car, FileText, Calendar, AlertTriangle, Bell } from 'lucide-react';

interface DashboardProps {
  activeDriversCount: number;
  availableVehiclesCount: number;
  totalBookings: number;
  todaysBookingsCount: number;
  isAtDriverLimit: boolean;
  pendingCustomerBookingsCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  activeDriversCount,
  availableVehiclesCount,
  totalBookings,
  todaysBookingsCount,
  isAtDriverLimit,
  pendingCustomerBookingsCount
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      
      {pendingCustomerBookingsCount > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-orange-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-orange-900">
                {pendingCustomerBookingsCount} New Customer {pendingCustomerBookingsCount === 1 ? 'Booking' : 'Bookings'} Pending Review
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Go to the Bookings page to review and confirm customer bookings with pricing.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isAtDriverLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Maximum Driver Limit Reached</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You have reached the Oxford City Council limit of 3 active drivers.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{activeDriversCount}/3</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Car className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">{availableVehiclesCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{todaysBookingsCount}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Oxford City Council Compliance</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Operator License Status</span>
            <span className="text-sm text-green-600">✓ Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Active Driver Count</span>
            <span className="text-sm text-green-600">{activeDriversCount}/3 Compliant</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Record Keeping</span>
            <span className="text-sm text-green-600">✓ 12 Month Retention</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;