import React, { useRef, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import clsx from "clsx";

export interface NotificationProps
  extends React.PropsWithChildren,
    React.ComponentPropsWithoutRef<"div"> {
  options?: any;
  getRef?: (el: HTMLDivElement) => void;
}

function Notification({
  className = "",
  options = {},
  getRef = () => {},
  children,
  ...computedProps
}: NotificationProps) {
  const initialRender = useRef(true);
  const toastifyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toastifyRef.current) {
      if (initialRender.current) {
        getRef(toastifyRef.current);
        initialRender.current = false;
      }
    }
  }, [getRef]);

  const showToast = () => {
    toast(children, {
      ...options,
      position: options.position || "top-right",
      autoClose: options.autoClose || 5000,
      hideProgressBar: options.hideProgressBar || false,
      closeOnClick: options.closeOnClick || true,
      pauseOnHover: options.pauseOnHover || true,
      draggable: options.draggable || true,
      progress: undefined,
    });
  };

  return (
    <div ref={toastifyRef} className={clsx(className)} {...computedProps}>
      <button onClick={showToast}>Show Notification</button>
      <ToastContainer />
    </div>
  );
}

export default Notification;