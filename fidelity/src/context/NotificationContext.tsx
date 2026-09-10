import Lucide from "@/components/Base/Lucide";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

type AnimationType = 'slide' | 'fade' | 'scale';

interface NotificationContextProps {
    showNotification: (content: ReactNode, options?: {
        variant?: 'success' | 'error' | 'warning' | 'info';
        duration?: number;
        position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
        animation?: AnimationType;
    }) => void;
}

interface ToastItem {
    id: string;
    content: ReactNode;
    variant: 'success' | 'error' | 'warning' | 'info' | undefined;
    duration: number;
    position: string;
    animation: AnimationType;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

function getVariantStyles(variant: ToastItem['variant']): string {
    switch (variant) {
        case 'success':
            return 'border-l-4 border-l-success bg-success/5';
        case 'error':
            return 'border-l-4 border-l-danger bg-danger/5';
        case 'warning':
            return 'border-l-4 border-l-warning bg-warning/5';
        case 'info':
            return 'border-l-4 border-l-info bg-info/5';
        default:
            return ""
    }
}

/**
 * Componente singolo toast con animazione CSS enter/exit.
 */
function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation nel prossimo frame
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const handleRemove = useCallback(() => {
        setVisible(false);
        // Attende la fine della transizione CSS prima di rimuovere dal DOM
        setTimeout(() => onRemove(toast.id), 300);
    }, [toast.id, onRemove]);

    useEffect(() => {
        if (toast.duration > 0) {
            const timer = setTimeout(handleRemove, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast.duration, handleRemove]);

    const initialTransform = getInitialTransform(toast.animation, toast.position);

    return (
        <div
            ref={ref}
            className={`bg-white rounded-md p-4 shadow-lg ${getVariantStyles(toast.variant)}`}
            style={{
                pointerEvents: 'auto',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translate(0,0) scale(1)' : initialTransform,
            }}
        >
            <div className="relative">
                <button
                    className="text-gray-500 hover:text-gray-700 absolute -top-2 -right-2"
                    onClick={handleRemove}
                    aria-label="Close notification"
                >
                    <Lucide icon="X" className="w-4 h-4" />
                </button>
                <div>
                    <div>
                        {toast.content}
                    </div>
                </div>
            </div>
        </div>
    );
}

function getInitialTransform(animation: AnimationType, position: string): string {
    switch (animation) {
        case 'fade':
            return 'translate(0,0) scale(1)';
        case 'scale':
            return 'translate(0,0) scale(0.8)';
        case 'slide':
        default:
            if (position.includes('right')) return 'translateX(100px) scale(1)';
            if (position.includes('left')) return 'translateX(-100px) scale(1)';
            if (position.includes('top')) return 'translateY(-50px) scale(1)';
            return 'translateY(50px) scale(1)';
    }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const showNotification = useCallback((content: ReactNode, options?: {
        variant?: 'success' | 'error' | 'warning' | 'info';
        duration?: number;
        position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
        animation?: AnimationType;
    }) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const newToast: ToastItem = {
            id,
            content,
            variant: options?.variant,
            duration: options?.duration || 5000,
            position: options?.position || 'top-right',
            animation: options?.animation || 'slide'
        };

        setToasts(prev => [...prev, newToast]);
    }, []);

    const getPositionStyles = (position: string) => {
        switch (position) {
            case 'top-left':
                return 'top-4 left-4';
            case 'top-center':
                return 'top-4 left-1/2 transform -translate-x-1/2';
            case 'top-right':
                return 'top-4 right-4';
            case 'bottom-left':
                return 'bottom-4 left-4';
            case 'bottom-center':
                return 'bottom-4 left-1/2 transform -translate-x-1/2';
            case 'bottom-right':
                return 'bottom-4 right-4';
            default:
                return 'top-4 right-4';
        }
    };

    const positions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}

            {positions.map(position => (
                <div
                    key={position}
                    className={`fixed ${getPositionStyles(position)} z-50 flex flex-col gap-2`}
                    style={{ pointerEvents: 'none' }}
                >
                    {toasts
                        .filter((toast) => toast.position === position)
                        .map((toast) => (
                            <Toast key={toast.id} toast={toast} onRemove={removeToast} />
                        ))}
                </div>
            ))}
        </NotificationContext.Provider>
    );
};
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
};
