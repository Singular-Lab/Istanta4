import clsx from 'clsx';
import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  className
}) => {
  return (
    <div className={clsx('mb-5 flex items-start justify-between', className)}>
      <div>
        <h1 className="text-3xl font-bold group-[.mode--light]:text-white group-[.mode--dark]:text-slate-800">
          {title}
        </h1>
        {description && (
          <div className="text-slate-500 mt-1 group-[.mode--light]:text-white group-[.mode--dark]:text-slate-800">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="ml-4">{actions}</div>}
    </div>
  );
};

export default PageHeader;
