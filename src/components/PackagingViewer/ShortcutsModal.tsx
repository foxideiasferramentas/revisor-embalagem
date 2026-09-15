import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span>⌨️</span> Atalhos do Sistema
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center font-bold transition-colors"
          >
            ×
          </button>
        </div>
        
        <div className="p-6 bg-slate-50">
          <div className="flex flex-col gap-3 text-sm">
            <ShortcutRow keys={['V']} description="Ferramenta Seleção / Mãozinha" />
            <ShortcutRow keys={['Espaço']} description="Segure para arrastar (Pan)" />
            <ShortcutRow keys={['M']} description="Ferramenta de Medição" />
            <ShortcutRow keys={['C']} description="Ferramenta de Anotações" />
            <ShortcutRow keys={['D']} description="Modo Comparação Visual (Diff)" />
            <ShortcutRow keys={['K']} description="Modo Chapas CMYK" />
            <ShortcutRow keys={['Ctrl', 'Scroll']} description="Zoom in/out na prancheta" />
            <ShortcutRow keys={['Shift', '?']} description="Abrir este menu de atalhos" />
          </div>
        </div>
        
        <div className="px-6 py-4 bg-white border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-sm w-full"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ShortcutRow: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-200/50 last:border-0">
    <span className="text-slate-600 font-medium">{description}</span>
    <div className="flex gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={k}>
          <kbd className="px-2 py-1 bg-white border border-slate-200 shadow-sm rounded-lg text-xs font-mono font-bold text-slate-700">
            {k}
          </kbd>
          {i < keys.length - 1 && <span className="text-slate-400 text-xs mt-1">+</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);
