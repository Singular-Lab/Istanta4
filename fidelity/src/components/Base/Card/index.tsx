import React from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'outline-primary' | 'outline-secondary' | 'icon';

interface CardOptions {
    bordered?: boolean;
    icon?: string;
    iconColor?: string;
}

interface CardProps {
    title: string;
    children: React.ReactNode;
    options?: CardOptions;
    variant?: Variant;
    className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, options, className }) => {
    return (
        <div className={clsx("bg-white rounded-lg p-4", className, { 'border': options?.bordered })}>
            <div className="border-b pb-2 mb-4 flex items-center">
                {options?.icon && (
                    <span className={clsx("mr-2", options.iconColor)}>
                        <i className={options.icon}></i>
                    </span>
                )}
                <h2 className="text-xl font-semibold">{title}</h2>
            </div>
            <div>
                {children}
            </div>
        </div>
    );
};

export default Card;