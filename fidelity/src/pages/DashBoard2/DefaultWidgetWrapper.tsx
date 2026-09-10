import { FC } from "react";

export const DefaultWidgetWrapper: FC<{
    children: React.ReactNode;
    isResizing?: boolean;
    currentSize?: { colSpan: number; rowSpan: number };
}> = ({ children, isResizing, currentSize }) => (
    <div className="h-full relative">
        {children}
        {isResizing && currentSize && (
            <div className="absolute bottom-2 right-2 bg-slate-800/90 text-white text-xs px-3 py-1.5 rounded shadow-lg z-50 pointer-events-none">
                {currentSize.colSpan}×{currentSize.rowSpan}
            </div>
        )}
    </div>
);

export default DefaultWidgetWrapper;