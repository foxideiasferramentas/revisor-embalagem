import React, { useRef, useState } from 'react';

interface PdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileA: { name: string; url: string; size: number } | null;
  fileB: { name: string; url: string; size: number } | null;
  onSelectFileA: (file: File) => void;
  onSelectFileB: (file: File) => void;
  onLoadSampleFiles?: () => void;
}

export const PdfUploadModal: React.FC<PdfUploadModalProps> = ({
  isOpen,
  onClose,
  fileA,
  fileB,
  onSelectFileA,
  onSelectFileB,
  onLoadSampleFiles,
}) => {
  const inputARef = useRef<HTMLInputElement | null>(null);
  const inputBRef = useRef<HTMLInputElement | null>(null);

  const [dragOverA, setDragOverA] = useState(false);
  const [dragOverB, setDragOverB] = useState(false);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slot: 'A' | 'B') => {
    e.preventDefault();
    if (slot === 'A') setDragOverA(false);
    if (slot === 'B') setDragOverB(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const isPdfOrImage =
        file.type === 'application/pdf' ||
        file.type.startsWith('image/') ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.png') ||
        file.name.toLowerCase().endsWith('.jpg') ||
        file.name.toLowerCase().endsWith('.jpeg') ||
        file.name.toLowerCase().endsWith('.webp');

      if (isPdfOrImage) {
        if (slot === 'A') onSelectFileA(file);
        else onSelectFileB(file);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isReadyToCompare = !!fileA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-100 w-full max-w-3xl rounded-3xl shadow-2xl p-7 relative flex flex-col gap-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold">
              📂
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Carregar Arquivos de Embalagem
              </h2>
              <p className="text-xs text-slate-500">
                Selecione os PDFs da versão original (A) e revisada (B) para inspeção no FoxBox.
              </p>
            </div>
          </div>
          {fileA && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Caixas de Upload Lado a Lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slot A: Arquivo Base / Versão Antiga */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverA(true);
            }}
            onDragLeave={() => setDragOverA(false)}
            onDrop={(e) => handleDrop(e, 'A')}
            onClick={() => inputARef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 relative ${
              dragOverA
                ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                : fileA
                ? 'border-blue-200 bg-blue-50/30'
                : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={inputARef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) onSelectFileA(e.target.files[0]);
              }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 mb-3">
              Versão A (Original / Referência)
            </span>

            {fileA ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-2">
                  {fileA.name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}
                </span>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[240px]" title={fileA.name}>
                  {fileA.name}
                </span>
                <span className="text-[11px] text-blue-600 font-semibold mt-1">
                  ✓ Carregado ({formatFileSize(fileA.size)})
                </span>
                <span className="text-[11px] text-slate-400 mt-2 hover:underline">
                  Clique para substituir
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xl mb-3 text-slate-500 shadow-2xs">
                  📥
                </div>
                <span className="text-xs font-bold text-slate-700">
                  Arraste ou clique para selecionar
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PDF ou Imagem (PNG, JPG)
                </span>
              </div>
            )}
          </div>

          {/* Slot B: Arquivo Revisado / Versão Nova */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverB(true);
            }}
            onDragLeave={() => setDragOverB(false)}
            onDrop={(e) => handleDrop(e, 'B')}
            onClick={() => inputBRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 relative ${
              dragOverB
                ? 'border-rose-500 bg-rose-50/50 scale-[1.01]'
                : fileB
                ? 'border-rose-200 bg-rose-50/30'
                : 'border-slate-200 hover:border-rose-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={inputBRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) onSelectFileB(e.target.files[0]);
              }}
            />
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 mb-3">
              Versão B (Revisão / Nova Versão)
            </span>

            {fileB ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-2">
                  {fileB.name.toLowerCase().endsWith('.pdf') ? '📑' : '🖼️'}
                </span>
                <span className="text-xs font-bold text-slate-800 truncate max-w-[240px]" title={fileB.name}>
                  {fileB.name}
                </span>
                <span className="text-[11px] text-rose-500 font-semibold mt-1">
                  ✓ Carregado ({formatFileSize(fileB.size)})
                </span>
                <span className="text-[11px] text-slate-400 mt-2 hover:underline">
                  Clique para substituir
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xl mb-3 text-slate-500 shadow-2xs">
                  📥
                </div>
                <span className="text-xs font-bold text-slate-700">
                  Arraste ou clique para selecionar
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PDF ou Imagem (PNG, JPG)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {onLoadSampleFiles && (
              <button
                type="button"
                onClick={onLoadSampleFiles}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1.5"
              >
                <span>🧪</span> Usar arquivos de demonstração FoxBox
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {fileA && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs"
              >
                Cancelar
              </button>
            )}

            <button
              type="button"
              disabled={!isReadyToCompare}
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              <span>🚀</span>
              {fileB ? 'Iniciar Inspeção e Comparação' : 'Abrir Documento A'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
