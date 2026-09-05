import React from 'react';

interface AdminCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function AdminCard({ title, description, children, action, className = '' }: AdminCardProps) {
  return (
    <div className={`bg-card border border-olive/10 rounded-md p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="flex justify-between items-start mb-4">
          <div>
            {title && <h3 className="font-serif text-base font-normal text-forest">{title}</h3>}
            {description && <p className="font-sans text-xs text-forest/60 mt-0.5">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
