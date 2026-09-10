import React, { FC } from 'react';
import Button from '@/components/Base/Button';
import Lucide from '@/components/Base/Lucide';
import { FormSelect } from '@/components/Base/Form';
import { TIPO_UTENTI } from '../../../../lib/enums';

interface DashboardToolbarProps {
    userRole: TIPO_UTENTI;
    setUserRole: (role: TIPO_UTENTI) => void;
    isSuperAdmin: boolean;
    isSaving: boolean;
    onAddWidget: () => void;
    onResetDashboard: () => void;
    onSaveLayout: () => void;
    onShowRoles: () => void;
}

/**
 * Toolbar della dashboard con controlli per admin
 */
export const DashboardToolbar: FC<DashboardToolbarProps> = ({
    userRole,
    setUserRole,
    isSuperAdmin,
    isSaving,
    onAddWidget,
    onResetDashboard,
    onSaveLayout,
    onShowRoles
}) => {
    if (!isSuperAdmin) return null;

    return (
        <div className="flex justify-between items-center mb-4 box box--stacked p-4">
            <div className="flex items-center space-x-3">
                <Button variant="primary" onClick={onAddWidget}>
                    <Lucide icon="Plus" className="w-4 h-4 mr-2" /> 
                    Aggiungi Widget
                </Button>
                <Button variant="outline-secondary" onClick={onResetDashboard}>
                    <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" /> 
                    Ripristina
                </Button>
            </div>
            <div className="flex items-center space-x-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/50">
                    <div className="flex items-center gap-1.5">
                        <Lucide icon="LayoutDashboard" className="w-4 h-4 text-slate-500" />
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            Modifica layout per:
                        </span>
                    </div>
                    <FormSelect
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value as TIPO_UTENTI)}
                        className="!py-1 !px-2 !text-sm !bg-white !border-slate-200"
                    >
                        <option value={TIPO_UTENTI.GDO}>Utenti GDO</option>
                        <option value={TIPO_UTENTI.AGENZIA}>Utenti Agenzia</option>
                        <option value={TIPO_UTENTI.SUPERADMIN}>Amministratori</option>
                    </FormSelect>
                </div>
                <Button 
                    variant="primary" 
                    onClick={onSaveLayout}
                    disabled={isSaving}
                >
                    <Lucide 
                        icon={isSaving ? "Loader" : "Save"} 
                        className={`w-4 h-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} 
                    /> 
                    {isSaving ? 'Salvataggio...' : 'Salva Layout'}
                </Button>
                <Button
                    variant="outline-secondary"
                    onClick={onShowRoles}
                >
                    <Lucide icon="Shield" className="w-4 h-4 mr-2" /> 
                    Permessi
                </Button>
            </div>
        </div>
    );
};