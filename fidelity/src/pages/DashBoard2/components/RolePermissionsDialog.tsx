import React, { FC, useState } from 'react';
import { Dialog } from '@/components/Base/Headless';
import { FormCheck } from '@/components/Base/Form';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { DashboardPlugin, WidgetRoleConfig } from '../types';

interface RolePermissionsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    plugins: DashboardPlugin[];
    onUpdatePluginRoles: (pluginId: string, roles: WidgetRoleConfig[]) => void;
}

/**
 * Dialog per gestire i permessi dei widget per ruolo
 */
export const RolePermissionsDialog: FC<RolePermissionsDialogProps> = ({
    isOpen,
    onClose,
    plugins,
    onUpdatePluginRoles
}) => {
    const [selectedPlugin, setSelectedPlugin] = useState<DashboardPlugin | null>(null);
    const [tempRoles, setTempRoles] = useState<WidgetRoleConfig[]>([]);

    const handlePluginSelect = (plugin: DashboardPlugin) => {
        setSelectedPlugin(plugin);
        setTempRoles([...plugin.allowedRoles]);
    };

    const handleBackToList = () => {
        setSelectedPlugin(null);
        setTempRoles([]);
    };

    const toggleRole = (roleType: TIPO_UTENTI) => {
        setTempRoles(prev => {
            const exists = prev.some(role => role.tipo === roleType);
            if (exists) {
                return prev.filter(role => role.tipo !== roleType);
            } else {
                const newRole: WidgetRoleConfig = {
                    tipo: roleType,
                    options: {
                        default: {
                            x: 0,
                            y: 0,
                            w: 4,
                            h: 3,
                            i: 'default'
                        }
                    }
                };
                return [...prev, newRole];
            }
        });
    };

    const handleSaveRoles = () => {
        if (!selectedPlugin) return;
        onUpdatePluginRoles(selectedPlugin.id, tempRoles);
        handleBackToList();
    };

    const handleClose = () => {
        handleBackToList();
        onClose();
    };

    return (
        <Dialog open={isOpen} onClose={handleClose} size="lg">
            <Dialog.Panel>
                <Dialog.Title>
                    {selectedPlugin
                        ? `Permessi – ${selectedPlugin.name}`
                        : 'Permessi widget'}
                </Dialog.Title>
                <Dialog.Description>
                    {!selectedPlugin ? (
                        <div className="divide-y border rounded-md">
                            {plugins.map(plugin => (
                                <div key={plugin.id} className="p-3 flex justify-between items-center">
                                    <div>
                                        <div className="font-medium">{plugin.name}</div>
                                        <div className="text-xs text-slate-500">
                                            Visibile a: {plugin.allowedRoles.map(role => role.tipo).join(', ')}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={() => handlePluginSelect(plugin)}
                                    >
                                        <Lucide icon="Pen" className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3 mt-4">
                            {Object.values(TIPO_UTENTI).map(roleType => (
                                <FormCheck key={roleType}>
                                    <FormCheck.Input
                                        type="checkbox"
                                        id={roleType}
                                        checked={tempRoles.some(role => role.tipo === roleType)}
                                        onChange={() => toggleRole(roleType)}
                                    />
                                    <FormCheck.Label htmlFor={roleType}>
                                        {roleType}
                                    </FormCheck.Label>
                                </FormCheck>
                            ))}
                        </div>
                    )}
                </Dialog.Description>
                {selectedPlugin && (
                    <Dialog.Footer>
                        <Button variant="outline-secondary" onClick={handleBackToList}>
                            Annulla
                        </Button>
                        <Button variant="primary" onClick={handleSaveRoles}>
                            Salva
                        </Button>
                    </Dialog.Footer>
                )}
            </Dialog.Panel>
        </Dialog>
    );
};
