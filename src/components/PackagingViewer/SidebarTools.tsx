import React from 'react';
import type { ActiveTool } from '../../types/packaging';

interface SidebarToolsProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  hasComparison: boolean;
  annotationsCount: number;
}

export const SidebarTools: React.FC<SidebarToolsProps> = ({
  activeTool,
  setActiveTool,
  hasComparison,
  annotationsCount,
}) => {
  return (
    <div className="w-16 bg-white border-r border-slate-200/80 flex flex-col items-center py-4 gap-4 shadow-sm z-30">
      <div className="flex flex-col gap-2">
        <ToolButton
          active={activeTool === 'select'}
          onClick={() => setActiveTool('select')}
          icon="✋"
          label="Mãozinha (V)"
          tooltip="Mãozinha (Pan). Atalho: V ou Segurar Espaço"
        />
        <ToolButton
          active={activeTool === 'measure'}
          onClick={() => setActiveTool('measure')}
          icon="📏"
          label="Medição (M)"
          tooltip="Régua de Medição (mm). Atalho: M"
        />
        <div className="relative">
          <ToolButton
            active={activeTool === 'annotate'}
            onClick={() => setActiveTool('annotate')}
            icon="💬"
            label="Anotar (C)"
            tooltip="Anotações. Atalho: C"
          />
          {annotationsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
              {annotationsCount}
            </span>
          )}
        </div>
      </div>

      <div className="w-8 h-px bg-slate-100 my-1" />

      <div className="flex flex-col gap-2">
        <ToolButton
          active={activeTool === 'diff'}
          onClick={() => setActiveTool('diff')}
          disabled={!hasComparison}
          icon="⚡"
          label="Comparar (D)"
          tooltip={!hasComparison ? 'Carregue a Versão B para comparar' : 'Comparar Versões. Atalho: D'}
        />
        <ToolButton
          active={activeTool === 'cmyk'}
          onClick={() => setActiveTool('cmyk')}
          icon="🎨"
          label="CMYK (K)"
          tooltip="Chapas CMYK. Atalho: K"
        />
      </div>
    </div>
  );
};

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
  tooltip: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ active, onClick, disabled, icon, tooltip }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-slate-400'
          : active
          ? 'bg-indigo-50 text-indigo-700 shadow-inner ring-1 ring-indigo-200'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
      title={tooltip}
    >
      <span className="text-lg">{icon}</span>
    </button>
  );
};
