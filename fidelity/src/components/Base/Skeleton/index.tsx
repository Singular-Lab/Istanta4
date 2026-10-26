// src/components/Base/Skeleton.tsx
import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
    height?: string;
    width?: string;
    borderRadius?: string;
    className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ height = '20px', width = '100%', borderRadius = '4px', className }) => {
    return (
        <div
            className={clsx('bg-gray-300 animate-shimmer bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300', className)}
            style={{ height, width, borderRadius, backgroundSize: '2000px 100%' }}
        />
    );
};

export default Skeleton;