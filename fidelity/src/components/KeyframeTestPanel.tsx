import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { useKeyframeEvents } from '@/context/KeyframeEventContext';
import React from 'react';

interface KeyframeTestPanelProps {
  componentId: string;
  componentType: string;
}

const KeyframeTestPanel: React.FC<KeyframeTestPanelProps> = ({ componentId, componentType }) => {
  const {
    selectedDate,
    hasActiveKeyframeFor,
    getComponentModifications,
    recordModification
  } = useKeyframeEvents();

  const hasActiveKeyframe = hasActiveKeyframeFor(componentId);
  const modifications = getComponentModifications(componentId);

  const handleTestModification = () => {
    const testContent = {
      testField: `Test keyframe-aware - ${new Date().toLocaleTimeString()}`,
      testTimestamp: Date.now(),
      testComponent: componentId
    };

    recordModification(componentId, 'content', testContent);
  };

  return (
    <div className="bg-white dark:bg-darkmode-700 border border-slate-200 dark:border-darkmode-500 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Test Keyframe-Aware
        </h4>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${hasActiveKeyframe ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-xs text-slate-500">
            {hasActiveKeyframe ? 'Keyframe Attivo' : 'Nessun Keyframe'}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Componente:</span>
          <span className="font-mono text-slate-800 dark:text-slate-200">{componentId}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Tipo:</span>
          <span className="text-slate-800 dark:text-slate-200">{componentType}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Data selezionata:</span>
          <span className="text-slate-800 dark:text-slate-200">
            {selectedDate ? selectedDate.format('DD/MM/YYYY') : 'Nessuna'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Modifiche:</span>
          <span className="text-slate-800 dark:text-slate-200">{modifications.length}</span>
        </div>
      </div>

      {hasActiveKeyframe && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-darkmode-500">
          <Button
            onClick={handleTestModification}
            variant="outline-primary"
            size="sm"
            className="w-full"
          >
            <Lucide icon="TestTube" className="w-3 h-3 mr-2" />
            Test Modifica Keyframe
          </Button>
        </div>
      )}

      {modifications.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-darkmode-500">
          <h5 className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Modifiche Attive:
          </h5>
          <div className="space-y-1">
            {modifications.map((mod, index) => (
              <div key={index} className="text-xs bg-slate-50 dark:bg-darkmode-600 p-2 rounded">
                <div className="font-mono text-slate-600 dark:text-slate-400">
                  {mod.modificationType} - {new Date(mod.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyframeTestPanel;
