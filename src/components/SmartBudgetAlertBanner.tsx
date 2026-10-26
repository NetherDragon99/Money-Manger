/**
 * Smart Budget Alert Banner
 * Displays intelligent threshold and over-budget warnings in Home and Budget views
 */

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, TrendingUp, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SmartBudgetAlertBanner: React.FC = () => {
  const { budgetAlerts, dismissedAlertIds, dismissBudgetAlert, settings, setCurrentTab } = useApp();
  const [isExpanded, setIsExpanded] = useState(true);
  const isArabic = settings.language === 'ar';

  const activeAlerts = budgetAlerts.filter((a) => !dismissedAlertIds.includes(a.categoryId));

  if (activeAlerts.length === 0) return null;

  const topAlert = activeAlerts[0];
  const isDanger = activeAlerts.some((a) => a.status === 'danger');

  return (
    <div className="mb-4 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl transition-all duration-200">
      {/* Banner Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition ${
          isDanger
            ? 'bg-red-950/40 border-b border-red-900/40 text-red-300'
            : 'bg-amber-950/40 border-b border-amber-900/40 text-amber-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isDanger ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-xs font-bold whitespace-normal break-words leading-relaxed max-w-full min-w-0 py-1">
            {isDanger
              ? isArabic
                ? `تحذير: تجاوزت الميزانية في ${topAlert.categoryName}!`
                : `Budget Exceeded in ${topAlert.categoryName}!`
              : isArabic
              ? `تنبيه: اقتراب حد الميزانية في ${topAlert.categoryName} (${topAlert.percentage}%)`
              : `Budget Alert: ${topAlert.categoryName} at ${topAlert.percentage}%`}
          </span>
          {activeAlerts.length > 1 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-900/80 text-zinc-300 border border-zinc-700 shrink-0">
              +{activeAlerts.length - 1}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentTab('budget');
            }}
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-900/90 text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            {isArabic ? 'عرض' : 'View'}
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </div>

      {/* Accordion Collapsible Alert Details */}
      <div className={`accordion-wrapper ${isExpanded ? 'open' : 'closed'}`}>
        <div className="accordion-inner bg-zinc-950/90 p-3 space-y-2">
          {activeAlerts.map((alert) => (
            <div
              key={alert.categoryId}
              className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{alert.categoryIcon}</span>
                <div className="min-w-0">
                  <div className="font-bold text-white whitespace-normal break-words leading-relaxed max-w-full min-w-0 py-1 flex items-center gap-1.5">
                    <span>{alert.categoryName}</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        alert.status === 'danger'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : alert.status === 'projected_danger'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {alert.percentage}%
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    {settings.currencySymbol}
                    {alert.totalSpent.toLocaleString()} / {settings.currencySymbol}
                    {alert.budgetLimit.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => dismissBudgetAlert(alert.categoryId)}
                  className="p-1 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  title="Dismiss alert"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
