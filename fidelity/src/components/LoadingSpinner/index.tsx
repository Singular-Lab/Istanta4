// src/components/LoadingSpinner.tsx
import Spinner from '@/components/Base/Spinner';
import { FC } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const MISURE = { small: 'sm', medium: 'md', large: 'lg' } as const;

// Spinner centrato con messaggio: lo spinner è quello comune di Base/Spinner
const LoadingSpinner: FC<LoadingSpinnerProps> = ({
  message = 'Caricamento...',
  size = 'medium'
}) => (
  <div role="status" className="flex flex-col items-center justify-center w-full h-full p-4">
    <Spinner decorativo size={MISURE[size]} />
    {message ? (
      <p className="mt-4 text-sm text-slate-700">{message}</p>
    ) : (
      <span className="sr-only">Caricamento…</span>
    )}
  </div>
);

export default LoadingSpinner;
