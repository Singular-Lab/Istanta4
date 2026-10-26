// src/components/LoadingSpinner.tsx
import { FC } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: FC<LoadingSpinnerProps> = ({ 
  message = 'Caricamento...', 
  size = 'medium' 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4 border-2',
    medium: 'w-8 h-8 border-4',
    large: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4">
      <div 
        className={`${sizeClasses[size]} border-t-primary border-gray-200 rounded-full animate-spin`}
        role="status"
      />
      {message && (
        <p className="mt-4 text-sm text-gray-700">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;