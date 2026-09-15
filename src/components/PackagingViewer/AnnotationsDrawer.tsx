import React, { useState } from 'react';
import type { Annotation } from '../../types/packaging';

interface AnnotationsDrawerProps {
  annotations: Annotation[];
  onSelectAnnotation: (annotation: Annotation) => void;
  onUpdateStatus: (id: string, status: 'approved' | 'rejected' | 'pending') => void;
}

export const AnnotationsDrawer: React.FC<AnnotationsDrawerProps> = ({
  annotations,
  onSelectAnnotation,
  onUpdateStatus,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (annotations.length === 0) {
    return null;
  }

  return (
    <>
      {/* Botão de abrir quando fechado */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-white px-2 py-6 rounded-l-2xl shadow-[inset_-1px_0_0_rgba(226,232,240,1),-4px_0_15px_rgba(0,0,0,0.05)] border border-slate-200 border-r-0 z-20 hover:bg-slate-50 transition-colors flex items-center justify-center group"
          title="Abrir painel de anotações"
        >
          <div className="flex flex-col gap-1 items-center">
            <span className="text-xs">◀</span>
            <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {annotations.length}
            </span>
          </div>
        </button>
      )}

      {/* Drawer */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-md shadow-2xl border-l border-slate-200 z-30 transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span>💬</span> Anotações ({annotations.length})
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center font-bold"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {annotations.map((annotation) => (
            <div
              key={annotation.id}
              onClick={() => onSelectAnnotation(annotation)}
              className="bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl p-3 cursor-pointer transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 group-hover:border-indigo-200">
                  ID: {annotation.id.substring(0, 6)}
                </span>
                
                {/* Indicador de Status */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(annotation.id, 'approved');
                    }}
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] transition-colors ${
                      annotation.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600'
                    }`}
                    title="Aprovar"
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(annotation.id, 'rejected');
                    }}
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] transition-colors ${
                      annotation.status === 'rejected' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-400 hover:bg-rose-100 hover:text-rose-600'
                    }`}
                    title="Rejeitar"
                  >
                    ×
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                {annotation.content}
              </p>

              {annotation.created_at && (
                <div className="mt-2 text-[10px] text-slate-400">
                  {new Date(annotation.created_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
