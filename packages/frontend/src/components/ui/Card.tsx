import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'brand';
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6",
        variant === 'default' && "bg-white border border-border shadow-soft",
        variant === 'glass' && "glass-card",
        variant === 'brand' && "glass-brand",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
