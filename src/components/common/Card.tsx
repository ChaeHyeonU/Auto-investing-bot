'use client';

import React from 'react';

/**
 * Reusable Card Component
 * 
 * A flexible card component for the trading dashboard.
 * Use Cursor AI to enhance styling and add animation effects.
 * 
 * Cursor AI Prompt Suggestion:
 * "Enhance this card component with modern shadows, hover effects, 
 * and smooth animations for a professional trading interface"
 */

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerAction?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  className = '',
  headerAction,
  loading = false,
  error = null,
  onClick,
  hoverable = false,
}) => {
  const baseClasses = `
    bg-slate-800 
    border border-slate-700 
    rounded-lg 
    overflow-hidden
    ${hoverable ? 'hover:bg-slate-750 transition-colors duration-200' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${className}
  `;

  return (
    <div className={baseClasses} onClick={onClick}>
      {/* Card Header */}
      {(title || subtitle || headerAction) && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-white">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="flex-shrink-0">
                {headerAction}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-4">
            <div className="text-sm">Error: {error}</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

/**
 * Specialized Card Components
 */

// Metric Card for displaying key performance indicators
interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeType?: 'percentage' | 'absolute';
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  change,
  changeType = 'percentage',
  icon,
  trend = 'neutral',
  className = '',
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '→';
    }
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-400 mb-1">{label}</div>
          <div className="text-2xl font-bold text-white">{value}</div>
          {change !== undefined && (
            <div className={`text-sm ${getTrendColor()} flex items-center mt-1`}>
              <span className="mr-1">{getTrendIcon()}</span>
              {changeType === 'percentage' ? `${change}%` : change}
            </div>
          )}
        </div>
        {icon && (
          <div className="text-2xl text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

// Status Card for system status indicators
interface StatusCardProps {
  title: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  description?: string;
  lastUpdate?: Date;
  className?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  status,
  description,
  lastUpdate,
  className = '',
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusDot = () => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'warning': return 'bg-yellow-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online': return 'Online';
      case 'warning': return 'Warning';
      case 'error': return 'Error';
      default: return 'Offline';
    }
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-lg font-semibold text-white mb-1">{title}</div>
          <div className={`flex items-center ${getStatusColor()}`}>
            <div className={`w-3 h-3 rounded-full ${getStatusDot()} mr-2`}></div>
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          {description && (
            <div className="text-sm text-gray-400 mt-1">{description}</div>
          )}
          {lastUpdate && (
            <div className="text-xs text-gray-500 mt-2">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default Card;