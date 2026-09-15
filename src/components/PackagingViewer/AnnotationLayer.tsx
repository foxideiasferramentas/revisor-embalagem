import React, { useState } from 'react';
import type { Annotation } from '../../types/packaging';

interface AnnotationLayerProps {
  width: number;
  height: number;
  isActive: boolean;
  annotations: Annotation[];
  onAddAnnotation: (newAnnotation: Omit<Annotation, 'id' | 'created_at'>) => void;
  onUpdateStatus?: (id: string, status: 'approved' | 'rejected' | 'pending') => void;
}

/**
 * Camada de Anotações Técnicas e Aprovação - Design System FoxBox.
 */
export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  width,
  height,
  isActive,
  annotations,
  onAddAnnotation,
  onUpdateStatus,
}) => {
  const [draftCoords, setDraftCoords] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) return;

    if ((e.target as HTMLElement).closest('.annotation-pin-content')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Number(((clickX / width) * 100).toFixed(4));
    const yPercent = Number(((clickY / height) * 100).toFixed(4));

    setDraftCoords({ xPercent, yPercent });
    setDraftContent('');
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftCoords || !draftContent.trim()) return;

    onAddAnnotation({
      pdf_id: 'sample-pdf-id',
      user_id: 'current-user-uuid',
      content: draftContent.trim(),
      x_coord: draftCoords.xPercent,
      y_coord: draftCoords.yPercent,
      status: 'pending',
    });

    setDraftCoords(null);
    setDraftContent('');
  };

  return (
    <div
      style={{ width, height }}
      onClick={handleContainerClick}
      className={`absolute inset-0 z-30 ${isActive ? 'cursor-chat cursor-pointer' : 'pointer-events-none'}`}
    >
      {/* Marcadores de Anotação Salvos */}
      {annotations.map((annotation, index) => {
        const isSelected = selectedAnnotationId === annotation.id;

        const badgeColors = {
          pending: 'bg-amber-500 text-white shadow-amber-500/30',
          approved: 'bg-emerald-600 text-white shadow-emerald-500/30',
          rejected: 'bg-rose-500 text-white shadow-rose-500/30',
        }[annotation.status];

        return (
          <div
            key={annotation.id}
            style={{
              left: `${annotation.x_coord}%`,
              top: `${annotation.y_coord}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute pointer-events-auto group z-30"
          >
            {/* Pino de Anotação */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnotationId(isSelected ? null : annotation.id);
              }}
              className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shadow-md border-2 border-white transition-transform transform hover:scale-110 active:scale-95 ${badgeColors}`}
              title={`Anotação #${index + 1}`}
            >
              {index + 1}
            </button>

            {/* Popup FoxBox */}
            {isSelected && (
              <div
                className="annotation-pin-content absolute left-9 top-0 w-72 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xl text-slate-800 text-xs z-50 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900">Anotação #{index + 1}</span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    annotation.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : annotation.status === 'rejected'
                      ? 'bg-rose-50 text-rose-500 border border-rose-100'
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {annotation.status}
                  </span>
                </div>
                <p className="text-slate-600 text-xs mb-3 whitespace-pre-wrap leading-relaxed">{annotation.content}</p>

                {onUpdateStatus && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onUpdateStatus(annotation.id, 'approved')}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] transition-colors"
                    >
                      ✓ Aprovar
                    </button>
                    <button
                      onClick={() => onUpdateStatus(annotation.id, 'rejected')}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-[11px] transition-colors"
                    >
                      ✕ Reprovar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Caixa de Entrada para Nova Nota (Draft) */}
      {draftCoords && (
        <div
          style={{
            left: `${draftCoords.xPercent}%`,
            top: `${draftCoords.yPercent}%`,
            transform: 'translate(-50%, -50%)',
          }}
          className="absolute z-40 pointer-events-auto annotation-pin-content"
          onClick={(e) => e.stopPropagation()}
        >
          <form
            onSubmit={handleSaveDraft}
            className="w-76 bg-white border border-slate-200/90 shadow-2xl rounded-2xl p-4 text-slate-900 animate-in zoom-in-95 duration-150"
          >
            <div className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-indigo-600 rounded-full inline-block" />
                Nova Anotação Técnica
              </span>
              <button
                type="button"
                onClick={() => setDraftCoords(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <textarea
              autoFocus
              rows={3}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Ex: Verificar legibilidade da tabela nutricional ou sangria da dobra..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none placeholder-slate-400"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setDraftCoords(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!draftContent.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-xs shadow-indigo-600/30 transition-colors"
              >
                Salvar Nota
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
