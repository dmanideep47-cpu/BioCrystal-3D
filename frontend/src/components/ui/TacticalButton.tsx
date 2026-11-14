import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface TacticalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  arrow?: boolean;
  loading?: boolean;
  loadingText?: string;
  cornerBrackets?: boolean;
  shortcut?: string;
  icon?: React.ReactNode;
}

export const TacticalButton: React.FC<TacticalButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  arrow = false,
  loading = false,
  loadingText,
  cornerBrackets,
  shortcut,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const isDisabled = disabled || loading;

  // Vercel-inspired button geometry (6px radius, balanced heights, font-medium)
  const sizeClasses = {
    sm: 'text-xs font-medium h-[34px] px-3.5 rounded-[6px]',
    md: 'text-xs font-medium h-[38px] px-4 rounded-[6px]',
    lg: 'text-sm font-medium h-[42px] px-4.5 rounded-[6px]',
    icon: 'h-[36px] w-[36px] p-0 rounded-[6px] justify-center',
  }[size];

  // Vercel-inspired Light Scientific Workstation Palette with 6px Radius & Subtle Borders
  const variantClasses = {
    primary:
      'bg-[#0F766E] hover:bg-[#115E59] active:bg-[#134E4A] text-white border border-[#0F766E] shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/20 focus-visible:border-[#0F766E]',
    secondary:
      'bg-white hover:bg-[#FAFAF9] active:bg-[#F5F5F4] text-[#171717] border border-[#E5E5E5] hover:border-[#D4D4D4] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/20 focus-visible:border-[#0F766E]',
    outline:
      'bg-white hover:bg-[#FAFAF9] active:bg-[#F5F5F4] text-[#171717] border border-[#E5E5E5] hover:border-[#D4D4D4] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/20 focus-visible:border-[#0F766E]',
    accent:
      'bg-[#171717] hover:bg-[#262626] active:bg-[#0A0A0A] text-white border border-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 focus-visible:border-[#171717]',
    ghost:
      'bg-transparent hover:bg-[#F5F5F5] active:bg-[#E5E5E5] text-[#737373] hover:text-[#171717] border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/20',
    destructive:
      'bg-[#FEF2F2] hover:bg-[#FEE2E2] active:bg-[#FECACA] text-[#DC2626] border border-[#FECACA] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/20 focus-visible:border-[#DC2626]',
  }[variant];

  return (
    <button
      disabled={isDisabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-[6px] normal-case tracking-normal transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 select-none cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <span
          className="w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin shrink-0 rounded-full"
          aria-hidden="true"
        />
      )}

      {/* Custom Icon */}
      {!loading && icon && <span className="shrink-0">{icon}</span>}

      {/* Label */}
      {children && (
        <span className="relative z-10 whitespace-nowrap">
          {loading ? loadingText || 'Processing…' : children}
        </span>
      )}

      {!loading && arrow && (
        <ArrowUpRight className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      )}

      {/* Keyboard Shortcut Badge */}
      {!loading && shortcut && (
        <span
          className="ml-1 px-1.5 py-0.5 text-[10px] rounded-[5px] border border-current pointer-events-none opacity-80"
          aria-hidden="true"
        >
          {shortcut}
        </span>
      )}
    </button>
  );
};

export const TacticalArrow = ArrowUpRight;
