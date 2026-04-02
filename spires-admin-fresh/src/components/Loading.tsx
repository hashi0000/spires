// components/Loading.tsx
import React from 'react';

const Loading: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div 
          className="w-10 h-10 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"
        ></div>
        <p className="text-gray-600">Loading Spires Taxis Admin...</p>
      </div>
    </div>
  );
};

export default Loading;