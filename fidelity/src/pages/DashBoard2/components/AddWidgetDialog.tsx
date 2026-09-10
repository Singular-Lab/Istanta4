import { Dialog } from '@/components/Base/Headless';
import EmptyState from '@/components/EmptyState';
import { FC } from 'react';
import { DashboardPlugin } from '../types';

interface AddWidgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableWidgets: DashboardPlugin[];
  onAddWidget: (widget: DashboardPlugin) => void;
}

/**
 * Dialog per aggiungere widget alla dashboard
 */
export const AddWidgetDialog: FC<AddWidgetDialogProps> = ({
  isOpen,
  onClose,
  availableWidgets,
  onAddWidget
}) => {
  const handleAddWidget = (widget: DashboardPlugin) => {
    onAddWidget(widget);
  };
  console.log(availableWidgets);
  return (
    <Dialog open={isOpen} onClose={onClose} size="md">
      <Dialog.Panel>
        <Dialog.Title>Aggiungi Widget</Dialog.Title>
        <Dialog.Description>
          {availableWidgets.length === 0 ? (
            <EmptyState
              icon="Info"
              title="Nessun widget disponibile"
              description="Non ci sono widget da aggiungere."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {availableWidgets.map(widget => (
                <div
                  key={widget.id}
                  className="border rounded-md p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                  onClick={() => handleAddWidget(widget)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAddWidget(widget);
                    }
                  }}
                >
                  <div className="font-medium mb-1">{widget.name}</div>
                  <div className="text-xs text-slate-500">
                    Dimensione: {widget.layout?.w || 4}×{widget.layout?.h || 4}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Dialog.Description>
      </Dialog.Panel>
    </Dialog>
  );
};
