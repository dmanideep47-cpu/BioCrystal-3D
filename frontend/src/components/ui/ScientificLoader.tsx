import React from 'react';

export interface ScientificLoaderProps {
  title?: string;
  stage?: string;
  subtext?: string;
  className?: string;
  compact?: boolean;
}

export const ScientificLoader: React.FC<ScientificLoaderProps> = ({
  title = 'Processing DNA Sequence Analysis',
  stage,
  subtext = 'Synchronizing alignment matrices, in-silico translation, and biophysical predictions…',
  className = '',
  compact = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center p-8 text-center bg-[#FFFFFF] ${className}`}
    >
      {/* DNA Double-Helix SVG Pulse Motif */}
      <div className="relative mb-5 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-center shadow-xs">
          <svg
            className="w-7 h-7 text-[#0F766E] motion-safe:animate-spin"
            style={{ animationDuration: '3s' }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* DNA double-helix rungs */}
            <path d="M2 15c6.667-6 13.333 0 20-6" />
            <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
            <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
            <path d="M17 6l-2.5-2.5" />
            <path d="M14 8l-1-1" />
            <path d="M7 18l2.5 2.5" />
            <path d="M3.5 14.5l.5.5" />
            <path d="M20 9.5l.5.5" />
            <path d="M6.5 12.5l1 1" />
            <path d="M16.5 10.5l1 1" />
            <path d="M10 16l1 1" />
          </svg>
        </div>
        {/* Subtle breathing ripple */}
        <span
          className="absolute inset-0 rounded-full border border-[#0F766E]/20 motion-safe:animate-ping opacity-30"
          style={{ animationDuration: '2.5s' }}
          aria-hidden="true"
        />
      </div>

      {/* Operation Title */}
      <h3 className="text-sm font-semibold text-[#171717] tracking-tight mb-1 font-sans">
        {title}
      </h3>

      {/* Stage Badge (if provided) */}
      {stage && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-[#F0FDFA] border border-[#CCFBF1] text-xs font-medium text-[#0F766E] mb-2 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] motion-safe:animate-pulse" />
          <span>{stage}</span>
        </div>
      )}

      {/* Subtext */}
      {!compact && subtext && (
        <p className="text-xs text-[#737373] max-w-md leading-relaxed mb-4">
          {subtext}
        </p>
      )}

      {/* Indeterminate Scientific Progress Bar */}
      <div className="w-64 max-w-full h-1 bg-[#E5E5E5] rounded-full overflow-hidden relative">
        <div
          className="absolute top-0 bottom-0 bg-[#0F766E] rounded-full transition-all duration-300"
          style={{
            width: '40%',
            animation: 'dna-indeterminate 1.8s infinite ease-in-out',
          }}
        />
      </div>

      <style>{`
        @keyframes dna-indeterminate {
          0% { left: -40%; width: 30%; }
          50% { left: 35%; width: 50%; }
          100% { left: 100%; width: 30%; }
        }
      `}</style>
    </div>
  );
};
