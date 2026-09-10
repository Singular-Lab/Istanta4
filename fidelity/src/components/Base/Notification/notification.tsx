import React from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface NotificationProps {
  options?: any;
}

const showToast = (message: string, options?: NotificationProps['options']) => {
  toast(message, {
    ...options,
    position: options?.position || "top-right",
    autoClose: options?.duration || 5000,
    hideProgressBar: options?.hideProgressBar || false,
    closeOnClick: options?.closeOnClick || true,
    pauseOnHover: options?.pauseOnHover || true,
    draggable: options?.draggable || true,
    progress: undefined,
  });
};

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
};

export { showToast, NotificationProvider };