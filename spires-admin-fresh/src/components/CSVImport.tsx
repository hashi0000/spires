// components/CSVImport.tsx - Add this as a NEW component
import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Download } from 'lucide-react';

interface CSVImportProps {
  onImport: (bookings: any[]) => Promise<void>;
  onClose: () => void;
}

const CSVImport: React.FC<CSVImportProps> = ({ onImport, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result as string;
        parseCSV(csvText);
      };
      reader.readAsText(file);
    } else {
      alert('Please select a CSV file');
    }
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('CSV file appears to be empty or invalid');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const bookings: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length >= 8) {
        const booking = {
          bookingNumber: `CSV${Date.now().toString().slice(-6)}${i}`,
          hirerName: values[0] || 'CSV Customer',
          hirerPhone: values[1] || '07000000000',
          hirerAddress: values[2] || 'Oxford, UK',
          pickupLocation: values[3] || '',
          destination: values[4] || '',
          pickupTime: parseDateAndTime(values[5], values[6]),
          dateTime: new Date().toISOString(),
          bookingMethod: 'internet' as const,
          status: 'pending' as const,
          actualFare: values[7] ? parseFloat(values[7]) : undefined,
          paymentMethod: (values[8] || 'cash') as 'cash' | 'card' | 'account',
          paymentStatus: 'pending' as const,
          notes: values[9] || 'Imported from CSV',
          driverId: null,
          vehicleId: null,
          expenses: [],
          createdAt: new Date()
        };

        if (booking.pickupLocation && booking.destination) {
          bookings.push(booking);
        }
      }
    }

    setPreview(bookings);
  };

  const parseDateAndTime = (dateStr: string, timeStr: string) => {
    try {
      // Handle DD/MM/YYYY format
      const dateParts = dateStr.split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
        const year = parseInt(dateParts[2]);
        
        const date = new Date(year, month, day);
        
        if (timeStr) {
          const timeParts = timeStr.split(':');
          if (timeParts.length >= 2) {
            date.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
          }
        }
        
        return date.toISOString();
      }
    } catch (error) {
      console.error('Error parsing date/time:', error);
    }
    
    return new Date().toISOString();
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setIsProcessing(true);
    try {
      let successCount = 0;
      for (const booking of preview) {
        try {
          await onImport(booking);
          successCount++;
        } catch (error) {
          console.error('Error importing booking:', error);
        }
      }

      if (successCount === preview.length) {
        alert(`✅ Successfully imported all ${successCount} bookings!`);
      } else {
        alert(`⚠️ Imported ${successCount} out of ${preview.length} bookings.`);
      }
      
      onClose();
    } catch (error) {
      alert('❌ Import failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Customer Name,Phone,Address,Pickup Location,Destination,Date,Time,Fare,Payment Method,Notes
Mr & Mrs Smith,07123456789,Oxford,Old Bank Hotel,Heathrow T2,25/01/2025,04:25,85.00,account,Viking account
Alice Brown,07987654321,456 High St,University,City Centre,26/01/2025,09:15,12.50,cash,Student discount`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Upload className="h-6 w-6 mr-3 text-blue-600" />
            Import CSV Bookings
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">📁 CSV Format Required</h3>
            <p className="text-blue-700 text-sm mb-3">
              Your CSV should have these columns in this exact order:
            </p>
            <div className="bg-white p-3 rounded border text-sm font-mono overflow-x-auto">
              Customer Name, Phone, Address, Pickup Location, Destination, Date, Time, Fare, Payment Method, Notes
            </div>
            <button
              onClick={downloadTemplate}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Click to select your CSV file</p>
              <p className="text-sm text-gray-500">Supported format: .csv files only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-900">
                  📋 Preview ({preview.length} bookings found)
                </h3>
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  {isProcessing ? 'Importing...' : `Import ${preview.length} Bookings`}
                </button>
              </div>
              
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">From</th>
                      <th className="px-3 py-2 text-left">To</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Time</th>
                      <th className="px-3 py-2 text-left">Fare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((booking, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">{booking.hirerName}</td>
                        <td className="px-3 py-2">{booking.pickupLocation}</td>
                        <td className="px-3 py-2">{booking.destination}</td>
                        <td className="px-3 py-2">
                          {new Date(booking.pickupTime).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-3 py-2">
                          {new Date(booking.pickupTime).toLocaleTimeString('en-GB', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </td>
                        <td className="px-3 py-2">
                          {booking.actualFare ? `£${booking.actualFare}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <div className="p-3 text-center text-gray-500 text-sm">
                    ... and {preview.length - 10} more bookings
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImport;