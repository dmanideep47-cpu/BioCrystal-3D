import React from 'react';
import {
  PlusCircle,
  Database,
  ListOrdered,
  Layers,
  GitCompare,
  FileText,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Dna,
} from 'lucide-react';

export type AppNavTab =
  | 'input'
  | 'navigator'
  | 'molecular'
  | 'comparison'
  | 'report'
  | 'help';

interface SidebarNavProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  hasAnalysisResults: boolean;
  hasStructureMapped: boolean;
  onNewAnalysis: () => void;
  mutationCount?: number;
}

interface NavItemConfig {
  id: AppNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled: boolean;
  badge?: string | number;
  tooltip: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  hasAnalysisResults,
  hasStructureMapped,
  onNewAnalysis,
  mutationCount = 0,
}) => {
  const items: NavItemConfig[] = [
    {
      id: 'input',
      label: 'Sequence Input',
      icon: Database,
      disabled: false,
      tooltip: 'Enter or edit reference and observed sequences (Stage A)',
    },
    {
      id: 'navigator',
      label: 'Mutation Navigator',
      icon: ListOrdered,
      disabled: !hasAnalysisResults,
      badge: hasAnalysisResults && mutationCount > 0 ? mutationCount : undefined,
      tooltip: hasAnalysisResults
        ? `Inspect ${mutationCount} detected sequence variant(s)`
        : 'Disabled until analysis succeeds',
    },
    {
      id: 'molecular',
      label: 'Molecular Workspace',
      icon: Layers,
      disabled: !hasAnalysisResults,
      tooltip: hasAnalysisResults
        ? '3D molecular surface visualization with localized mutations'
        : 'Disabled until analysis succeeds',
    },
    {
      id: 'comparison',
      label: 'Structural Comparison',
      icon: GitCompare,
      disabled: !hasStructureMapped,
      tooltip: hasStructureMapped
        ? 'Side-by-side reference conformation comparison'
        : 'Disabled until 3D structure is mapped',
    },
    {
      id: 'report',
      label: 'Scientific Report',
      icon: FileText,
      disabled: !hasAnalysisResults,
      tooltip: hasAnalysisResults
        ? 'Formal computational biology assessment and PDF report'
        : 'Disabled until analysis succeeds',
    },
    {
      id: 'help',
      label: 'Help & Limitations',
      icon: HelpCircle,
      disabled: false,
      tooltip: 'Scientific methodology, coordinate transformations & limitations',
    },
  ];

  return (
    <aside
      id="bc-sidebar-nav"
      aria-label="Scientific Workstation Navigation"
      className={`h-full bg-[#111316] border-r border-[#2A2D33] flex flex-col justify-between py-3 select-none shrink-0 transition-all duration-200 z-20 ${
        isCollapsed ? 'w-14' : 'w-60'
      }`}
    >
      <div className="space-y-4">
        {/* Sidebar Header & Accessible Toggle Control */}
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
            title={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* New Analysis Primary Button */}
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

        {/* Main Workstation Navigation Items */}
        <div className="px-2 space-y-1">
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
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
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

                {!isCollapsed && item.badge !== undefined && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ml-1.5 bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30">
                    {item.badge}
                  </span>
                )}

                {/* Left Active Pip */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FF6500] rounded-r" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info & Provenance */}
      {!isCollapsed && (
        <div className="px-3 pt-2 border-t border-[#2A2D33] text-[10px] text-[#70757D] font-mono space-y-1">
          <div className="flex items-center justify-between">
            <span>Biopython / 3Dmol</span>
            <span className="text-[#35C98A] font-semibold">ONLINE</span>
          </div>
          <div className="text-[9px] text-[#70757D] leading-tight">
            Scientific Mutation Workstation
          </div>
        </div>
      )}
    </aside>
  );
};
