import React from 'react';
import {
  Database,
  GitCompare,
  FileText,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Dna,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import { BackendStatus } from '../../types/dna';

export type AppNavTab = 'analyze' | 'results' | 'report';

interface SidebarNavProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  hasAnalysisResults: boolean;
  hasStructureMapped?: boolean;
  onNewAnalysis: () => void;
  mutationCount?: number;
  isModified?: boolean;
  backendStatus?: BackendStatus;
  onRetryBackend?: () => void;
  onOpenHelp?: () => void;
}

interface NavItemConfig {
  id: AppNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
  badge?: string | number;
  badgeType?: 'mutation' | 'modified';
  tooltip: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  hasAnalysisResults,
  onNewAnalysis,
  mutationCount = 0,
  isModified = false,
  backendStatus = 'CONNECTING',
  onRetryBackend,
  onOpenHelp,
}) => {
  // Exactly THREE non-negotiable destinations
  const items: NavItemConfig[] = [
    {
      id: 'analyze',
      label: 'Analyze',
      icon: Database,
      disabled: false,
      tooltip: 'Paste mutated DNA and compare against reference (Destination 1)',
    },
    {
      id: 'results',
      label: 'Results & Edit',
      icon: GitCompare,
      disabled: !hasAnalysisResults,
      badge: hasAnalysisResults && mutationCount > 0 ? mutationCount : undefined,
      badgeType: 'mutation',
      tooltip: hasAnalysisResults
        ? `Inspect ${mutationCount} variant(s), edit sequence & view 3D structure (Destination 2)`
        : 'Disabled until sequence analysis is executed',
    },
    {
      id: 'report',
      label: 'Report',
      icon: FileText,
      disabled: !hasAnalysisResults,
      tooltip: hasAnalysisResults
        ? 'Download 4-page scientific report and CSV export (Destination 3)'
        : 'Disabled until sequence analysis is executed',
    },
  ];

  return (
    <aside
      id="bc-sidebar-nav"
      aria-label="Scientific Workstation Navigation Rail"
      className={`h-full bg-[#111316] border-r border-[#2A2D33] flex flex-col justify-between py-3 select-none shrink-0 transition-all duration-200 z-20 ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div className="space-y-3">
        {/* Header with Title and Accessible Collapse/Expand Toggle */}
        <div className="px-3 flex items-center justify-between pb-2 border-b border-[#2A2D33]/80">
          {!isCollapsed && (
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 rounded bg-[#17191D] border border-[#2A2D33] flex items-center justify-center text-[#FF6500]">
                <Dna className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-mono font-bold text-[#F4F4F2] uppercase tracking-wider truncate">
                BioCrystal <span className="text-[#FF6500]">3D</span>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-expanded={!isCollapsed}
            aria-controls="bc-sidebar-nav"
            className="p-1.5 rounded-md text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#1D2025] transition-all ml-auto focus:outline-none focus:ring-1 focus:ring-[#FF6500] cursor-pointer"
            title={isCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Action: New Analysis / Reset */}
        <div className="px-2">
          <button
            type="button"
            onClick={onNewAnalysis}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center p-2' : 'px-3 py-2 space-x-2'
            } rounded-md text-xs font-mono font-bold bg-[#17191D] hover:bg-[#1D2025] text-[#35C98A] border border-[#2A2D33] hover:border-[#35C98A]/40 transition-all cursor-pointer`}
            title="Start new analysis with clean input sequences"
          >
            <PlusCircle className="w-4 h-4 shrink-0 text-[#35C98A]" />
            {!isCollapsed && <span>New Analysis</span>}
          </button>
        </div>

        {/* The 3 Core Navigation Items */}
        <nav className="px-2 space-y-1">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => !item.disabled && setActiveTab(item.id)}
                title={item.tooltip}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                } rounded-md text-xs font-mono transition-all group relative cursor-pointer ${
                  item.disabled
                    ? 'opacity-35 cursor-not-allowed text-[#70757D]'
                    : isActive
                    ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] shadow-sm font-semibold'
                    : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      item.disabled
                        ? 'text-[#70757D]'
                        : isActive
                        ? 'text-[#FF6500]'
                        : 'text-[#70757D] group-hover:text-[#A0A3AA]'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate text-left">{item.label}</span>}
                </div>

                {/* Badge for Mutations or Modified State */}
                {!isCollapsed && (
                  <div className="flex items-center space-x-1 shrink-0 ml-1.5">
                    {item.id === 'results' && isModified && (
                      <span
                        className="w-2 h-2 rounded-full bg-[#F3B347] animate-pulse"
                        title="Sequence modified since last run"
                      />
                    )}
                    {item.badge !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}

                {/* Active Indicator Strip */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FF6500] rounded-r" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: Help Modal Trigger & Backend Health */}
      <div className="space-y-2">
        {onOpenHelp && (
          <div className="px-2">
            <button
              type="button"
              onClick={onOpenHelp}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'px-3 py-1.5 space-x-2'
              } rounded text-xs font-mono text-[#70757D] hover:text-[#F4F4F2] hover:bg-[#17191D] transition-colors cursor-pointer`}
              title="Methodology, References & Scientific Limitations"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span className="text-[11px]">Methodology & Help</span>}
            </button>
          </div>
        )}

        {!isCollapsed ? (
          <div className="px-3 pt-2 border-t border-[#2A2D33] text-[10px] text-[#70757D] font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="truncate">FastAPI / Bio</span>
              <div className="flex items-center space-x-1.5 shrink-0">
                {backendStatus === 'ONLINE' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#35C98A] animate-pulse" />
                    <span className="text-[#35C98A] font-semibold">ONLINE</span>
                  </>
                ) : backendStatus === 'CONNECTING' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F3B347] animate-ping" />
                    <span className="text-[#F3B347] font-semibold">CONNECTING</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F06464]" />
                    <span className="text-[#F06464] font-semibold">{backendStatus}</span>
                    {onRetryBackend && (
                      <button
                        type="button"
                        onClick={onRetryBackend}
                        className="p-0.5 rounded text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#1D2025] transition-all cursor-pointer"
                        title="Retry FastAPI health check"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="text-[9px] text-[#70757D] leading-tight">
              3-Destination Scientific Workstation
            </div>
          </div>
        ) : (
          <div className="px-2 pt-2 border-t border-[#2A2D33] flex justify-center">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'ONLINE'
                  ? 'bg-[#35C98A]'
                  : backendStatus === 'CONNECTING'
                  ? 'bg-[#F3B347]'
                  : 'bg-[#F06464]'
              }`}
              title={`Backend: ${backendStatus}`}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
