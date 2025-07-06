'use client';

import React from 'react';
import { StatusCard } from '@/components/common/Card';

/**
 * Dashboard Layout Component
 * 
 * Provides consistent layout structure for the trading dashboard.
 * Use Cursor AI to enhance with navigation, breadcrumbs, and responsive behavior.
 */

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  sidebarContent?: React.ReactNode;
  isConnected?: boolean;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title = 'Auto Trading System',
  subtitle,
  headerActions,
  sidebarContent,
  isConnected = false,
  className = '',
}) => {
  return (
    <div className={`min-h-screen bg-slate-900 text-white ${className}`}>
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div>
              <h1 className="text-2xl font-bold text-white">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
              )}
            </div>
            <StatusCard
              title="System"
              status={isConnected ? 'online' : 'offline'}
              description={isConnected ? 'Connected' : 'Disconnected'}
              className="bg-transparent border-none p-0"
            />
          </div>
          
          {headerActions && (
            <div className="flex items-center space-x-4">
              {headerActions}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        {sidebarContent && (
          <aside className="w-80 bg-slate-800 border-r border-slate-700 p-6 overflow-y-auto">
            {sidebarContent}
          </aside>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 p-6 overflow-y-auto ${!sidebarContent ? 'w-full' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

/**
 * Dashboard Grid Component for consistent layouts
 */
interface DashboardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  children,
  columns = 3,
  className = '',
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-6 h-full ${className}`}>
      {children}
    </div>
  );
};

/**
 * Dashboard Section Component for content organization
 */
interface DashboardSectionProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  children,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || subtitle || actions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h2 className="text-xl font-semibold text-white">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center space-x-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
};

export default DashboardLayout;