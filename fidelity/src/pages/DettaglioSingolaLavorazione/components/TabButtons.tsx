import React from 'react';
import { Tab } from "@/components/Base/Headless";
import clsx from "clsx";
import { FileItemKit } from '../../../../lib/types';

interface TabButtonsProps {
    activeTab: number;
    setActiveTab: (index: number) => void;
    filteredFiles: FileItemKit[];
    groupedFiles: {
        uploaded: FileItemKit[];
        pendingUpload: FileItemKit[];
        notUploaded: FileItemKit[];
    };
}

const TabButtons = ({ activeTab, setActiveTab, filteredFiles, groupedFiles }: TabButtonsProps) => {
    const tabs = [
        { name: 'Tutti', count: filteredFiles?.length || 0 },
        { name: 'Caricati', count: groupedFiles.uploaded.length, variant: 'success' },
        { name: 'In attesa', count: groupedFiles.pendingUpload.length, variant: 'warning' },
        { name: 'Da caricare', count: groupedFiles.notUploaded.length, variant: 'danger' },
    ];

    return (
        <div className="mb-5">
            <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
                <Tab.List variant="boxed-tabs" className="flex-col sm:flex-row sm:w-auto mr-auto bg-white box rounded-[0.6rem] border-slate-200">
                    {tabs.map((tab, index) => (
                        <Tab key={index} className="bg-slate-50 first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] [&[aria-selected='true']_button]:text-current">
                            <Tab.Button className={clsx("w-full py-2 text-slate-500 whitespace-nowrap rounded-[0.6rem] flex items-center justify-center text-[0.85rem]")} as="button">
                                {tab.name}
                                {tab.count > 0 && (
                                    <span className={clsx("ml-2 text-xs px-1.5 py-0.5 rounded-full",
                                        tab.variant === 'success' ? "bg-success/10 text-success" :
                                            tab.variant === 'warning' ? "bg-warning/10 text-warning" :
                                                tab.variant === 'danger' ? "bg-danger/10 text-danger" :
                                                    "bg-slate-100 text-slate-600"
                                    )}>
                                        {tab.count}
                                    </span>
                                )}
                            </Tab.Button>
                        </Tab>
                    ))}
                </Tab.List>
            </Tab.Group>
        </div>
    );
};

export default TabButtons; 