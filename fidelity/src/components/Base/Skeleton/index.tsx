// src/components/Base/Skeleton.tsx
import React from 'react';
import { twMerge } from "@/utils/twMerge";

interface SkeletonProps {
    height?: string;
    width?: string;
    borderRadius?: string;
    className?: string;
}

// Le dimensioni predefinite sono classi, cosi quelle passate con className le sostituiscono;
// height, width e borderRadius valgono solo se indicati esplicitamente.
const Skeleton: React.FC<SkeletonProps> = ({ height, width, borderRadius, className }) => {
    return (
        <div
            aria-hidden="true"
            className={twMerge('w-full h-5 rounded bg-slate-200 animate-shimmer bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200', className)}
            style={{ height, width, borderRadius, backgroundSize: '2000px 100%' }}
        />
    );
};

export default Skeleton;
