import { useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Base/Headless/Dialog'; // Assicurati di importare il componente Dialog corretto

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface UseDialogProps {
    size?: Size;
    staticBackdrop?: boolean;
}

interface UseDialogReturn {
    openDialog: () => void;
    closeDialog: () => void;
    DialogComponent: ({ children }: { children: ReactNode }) => React.ReactPortal | null;
}

export const useDialog = ({
    size = 'md',
    staticBackdrop = false,
}: UseDialogProps = {}): UseDialogReturn => {
    const [isOpen, setIsOpen] = useState(false);

    const openDialog = () => setIsOpen(true);
    const closeDialog = () => setIsOpen(false);

    const DialogComponent = ({ children }: { children: ReactNode }) => (
        isOpen ? createPortal(
            <Dialog open={isOpen} onClose={closeDialog} size={size} staticBackdrop={staticBackdrop}>
                {children}
            </Dialog>,
            document.body
        ) : null
    );

    return { openDialog, closeDialog, DialogComponent };
};