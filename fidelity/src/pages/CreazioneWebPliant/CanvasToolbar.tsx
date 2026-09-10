import React from 'react';
import Lucide from '@/components/Base/Lucide';
import Button from '@/components/Base/Button';

interface CanvasToolbarProps {
    onAddComponent: () => void;
    onSave: () => void;
    onUndo: () => void;
    onRedo: () => void;
}

export const CanvasToolbar = ({
    onAddComponent,
    onSave,
    onUndo,
    onRedo
}: CanvasToolbarProps) => {
    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full shadow-lg border border-slate-200 z-10">
            <div className="flex items-center p-1">
                <Button
                    variant="primary"
                    className="rounded-full"
                    onClick={onAddComponent}
                >
                    <Lucide icon="Plus" className="w-4 h-4" />
                    <span className="ml-1">Componenti</span>
                </Button>

                <div className="mx-2 w-px h-6 bg-slate-200"></div>

                <Button.Group>
                    <Button variant="outline-secondary" className="rounded-l-full" onClick={onUndo}>
                        <Lucide icon="Undo" className="w-4 h-4" />
                    </Button>
                    <Button variant="outline-secondary" className="rounded-r-full" onClick={onRedo}>
                        <Lucide icon="Redo" className="w-4 h-4" />
                    </Button>
                </Button.Group>

                <div className="mx-2 w-px h-6 bg-slate-200"></div>

                <Button variant="success" onClick={onSave}>
                    <Lucide icon="Save" className="w-4 h-4 mr-1" />
                    Salva
                </Button>
            </div>
        </div>
    );
}; 