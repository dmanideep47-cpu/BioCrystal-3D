import React, { useState } from 'react';
import {
  Boxes,
  FlaskConical,
  GitCompare,
  FileText,
  Database,
  Binary,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export type ActiveTab =
  | 'viewer'
  | 'mutation-lab'
  | 'comparison'
  | 'sequence-explorer'
  | 'intelligent-analysis'
  | 'analysis-report'
  | 'reference-data';

interface SidebarNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  hasMutation: boolean;
}

interface NavSection {
  title: string;
  items: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  setActiveTab,
  hasMutation,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const sections: NavSection[] = [
    {
      title: 'MOLECULAR VIEW',
      items: [
        {
          id: 'viewer',
          label: '3D Structure',
          icon: Boxes,
        },
        {
          id: 'comparison',
          label: 'Molecular Comparison',
          icon: GitCompare,
          badge: hasMutation ? 'Diff' : undefined,
        },
      ],
    },
    {
      title: 'SEQUENCE ANALYSIS',
      items: [
        {
          id: 'reference-data',
          label: 'Sequence Input',
          icon: Database,
        },
        {
          id: 'sequence-explorer',
          label: 'Sequence Explorer',
          icon: Binary,
        },
        {
          id: 'mutation-lab',
          label: 'Mutation Laboratory',
          icon: FlaskConical,
          badge: hasMutation ? 'Active' : undefined,
        },
        {
          id: 'intelligent-analysis',
          label: 'Intelligent Mutation Analysis',
          icon: Sparkles,
          badge: 'AI Core',
        },
      ],
    },
    {
      title: 'RESULTS',
      items: [
        {
          id: 'analysis-report',
          label: 'Scientific Report',
          icon: FileText,
        },
      ],
    },
  ];

  return (
    <aside
      className={`h-full bg-[#111316] border-r border-[#2A2D33] flex flex-col justify-between py-3 select-none shrink-0 transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-[245px]'
      }`}
    >
      <div className="space-y-4 overflow-y-auto overflow-x-hidden">
        {/* Collapse toggle header */}
        <div className="px-3 flex items-center justify-between pb-2 border-b border-[#2A2D33]/80">
          {!isCollapsed && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#70757D] font-semibold">
              Workstation Navigation
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#1D2025] transition-all ml-auto cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Sections */}
        {sections.map((sec, secIdx) => (
          <div key={secIdx} className="px-2">
            {!isCollapsed && (
              <p className="text-[9px] font-mono font-bold text-[#70757D] uppercase tracking-wider px-2 mb-1.5">
                {sec.title}
              </p>
            )}
            <div className="space-y-1">
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-2.5 py-2'
                    } rounded-md text-xs font-medium transition-all group relative cursor-pointer ${
                      isActive
                        ? 'bg-[#1D2025] text-[#F4F4F2] border border-[#3D424B] shadow-sm'
                        : 'text-[#A0A3AA] hover:text-[#F4F4F2] hover:bg-[#17191D]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-[#FF6500]'
                            : 'text-[#70757D] group-hover:text-[#A0A3AA]'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate text-left">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium shrink-0 ml-1.5 ${
                          item.badge === 'Active'
                            ? 'bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30'
                            : item.badge === 'Diff'
                            ? 'bg-[#F3B347]/15 text-[#F3B347] border border-[#F3B347]/30'
                            : 'bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Left active marker indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FF6500] rounded-r" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Scientific Guidance Card */}
        {!isCollapsed && (
          <div className="px-3 pt-2">
            <div className="bg-[#090A0C] rounded-md p-2.5 border border-[#2A2D33] text-xs">
              <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-mono text-[#F4F4F2]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#35C98A]" />
                <span className="font-semibold">B-DNA Parameters</span>
              </div>
              <p className="text-[10px] text-[#70757D] leading-relaxed">
                Right-handed double helix · 10 bp/turn · 3.4 Å helical rise · 36° twist · Minor groove phase offset 144°.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="px-4 pt-2 border-t border-[#2A2D33] text-[10px] text-[#70757D] font-mono flex items-center justify-between">
          <span>Biopython / Three.js</span>
          <span className="text-[9px] text-[#35C98A] font-semibold">ONLINE</span>
        </div>
      )}
    </aside>
  );
};
