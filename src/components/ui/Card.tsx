import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ className, padding = 'md', children, ...props }) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-12',
  };

  return (
    <div 
      className={cn('glass-card', paddings[padding], className)} 
      {...props}
    >
      {children}
    </div>
  );
};
