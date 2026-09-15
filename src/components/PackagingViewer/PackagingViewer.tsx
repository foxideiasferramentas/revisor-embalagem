import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePdfLoader } from '../../hooks/usePdfLoader';
import { DocumentCanvas } from './DocumentCanvas';
import { MeasurementLayer } from './MeasurementLayer';
import { AnnotationLayer } from './AnnotationLayer';
import { PdfDiffViewer } from './PdfDiffViewer';
import { CmykViewer } from './CmykViewer';
import { PdfUploadModal } from './PdfUploadModal';
import { getDocumentType } from '../../utils/fileTypes';
import type { ActiveTool, Annotation, FileItem } from '../../types/packaging';

export type { FileItem };

export interface PackagingViewerProps {
  primaryPdf: FileItem | null;
  comparisonPdf: FileItem | null;
  projectName?: string;
  onBackToDashboard?: () => void;
  onSelectFileA: (file: File) => void;
  onSelectFileB: (file: File) => void;
  onLoadSampleFiles?: () => void;
  initialAnnotations?: Annotation[];
  onSaveAnnotationToSupabase?: (annotation: Omit<Annotation, 'id' | 'created_at'>) => Promise<void>;
  onUpdateAnnotationStatus?: (id: string, status: 'approved' | 'rejected' | 'pending') => Promise<void>;
}

/**
 * Componente Principal de Engenharia e Aprovação de Embalagens Técnicas.
 * Inclui navegação Pan com a mãozinha (drag & scroll) e zoom dinâmico.
 */
export const PackagingViewer: React.FC<PackagingViewerProps> = ({
  primaryPdf,
  comparisonPdf,
  projectName = 'Embalagem Técnica',
  onBackToDashboard,
  onSelectFileA,
  onSelectFileB,
  onLoadSampleFiles,
  initialAnnotations = [],
  onSaveAnnotationToSupabase,
  onUpdateAnnotationStatus,
}) => {
  // Estado de Navegação e Zoom
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [activeTool, setActiveTool] = useState<ActiveTool>(comparisonPdf ? 'diff' : 'select');
  const [viewDocument, setViewDocument] = useState<'A' | 'B'>('A');

  // Controle de Pan (Mãozinha para mover a prancheta)
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // Controle do Modal de Upload
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(!primaryPdf);

  // Dimensões visuais reportadas pelo PdfCanvas (CSS pixels)
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 1100,
  });

  // Lista local de anotações
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);

  // Detecção dos tipos de documento (PDF vs Imagem JPG/PNG)
  const isImageA = primaryPdf ? getDocumentType(primaryPdf.name) === 'image' : false;
  const isImageB = comparisonPdf ? getDocumentType(comparisonPdf.name) === 'image' : false;

  const activeFile = viewDocument === 'A' ? primaryPdf : comparisonPdf || primaryPdf;
  const activeIsImage = activeFile ? getDocumentType(activeFile.name) === 'image' : false;

  // Carregamento dos documentos PDF (apenas se for PDF)
  const { pdfDoc: primaryDoc, numPages: numPagesA, isLoading: loadingA, error: errorA } = usePdfLoader(
    isImageA ? null : primaryPdf?.url || null
  );
  const { pdfDoc: comparisonDoc, numPages: numPagesB, isLoading: loadingB, error: errorB } = usePdfLoader(
    isImageB ? null : comparisonPdf?.url || null
  );

  const activeDoc = viewDocument === 'A' ? primaryDoc : comparisonDoc || primaryDoc;
  const currentNumPages = activeIsImage ? 1 : Math.max(numPagesA, numPagesB) || 1;

  const handleDimensionsChange = useCallback((dims: { width: number; height: number }) => {
    setCanvasDimensions(dims);
  }, []);

  // Atalho de teclado para a Mãozinha (segurar tecla Espaço)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em textarea/input
      if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleZoomIn = () => setScale((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 4.0));
  const handleZoomOut = () => setScale((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 0.5));
  const handleResetZoomAndPan = () => {
    setScale(1.0);
    setPanPosition({ x: 0, y: 0 });
  };

  // Manipuladores de Pan (Mãozinha)
  const canPan = activeTool === 'select' || isSpacePressed;

  const handlePointerDownPan = (e: React.PointerEvent<HTMLDivElement>) => {
    // Permite pan se a ferramenta for select (mãozinha), se Espaço estiver pressionado ou com o botão do meio
    if (!canPan && e.button !== 1) return;

    // Impede iniciar pan caso tenha clicado em um formulário ou botão interno
    if ((e.target as HTMLElement).closest('button, input, textarea, .annotation-pin-content')) {
      return;
    }

    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panPosition.x,
      initialPanY: panPosition.y,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMovePan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const deltaX = e.clientX - panStartRef.current.startX;
    const deltaY = e.clientY - panStartRef.current.startY;

    setPanPosition({
      x: panStartRef.current.initialPanX + deltaX,
      y: panStartRef.current.initialPanY + deltaY,
    });
  };

  const handlePointerUpPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setIsPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Zoom suave com a roda do mouse quando segurar Ctrl ou diretamente na prancheta
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
      setScale((prev) => Math.min(Math.max(Number((prev + zoomFactor).toFixed(2)), 0.4), 4.5));
    }
  };

  const handleAddAnnotation = async (newAnnotation: Omit<Annotation, 'id' | 'created_at'>) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: Annotation = {
      ...newAnnotation,
      id: tempId,
      created_at: new Date().toISOString(),
    };

    setAnnotations((prev) => [...prev, optimisticItem]);

    if (onSaveAnnotationToSupabase) {
      try {
        await onSaveAnnotationToSupabase(newAnnotation);
      } catch (err) {
        console.error('Falha ao salvar anotação no Supabase:', err);
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

    if (onUpdateAnnotationStatus) {
      try {
        await onUpdateAnnotationStatus(id, status);
      } catch (err) {
        console.error('Falha ao atualizar status no Supabase:', err);
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] text-slate-900 font-sans select-none overflow-hidden">
      {/* Modal de Upload de PDFs */}
      <PdfUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        fileA={primaryPdf}
        fileB={comparisonPdf}
        onSelectFileA={onSelectFileA}
        onSelectFileB={onSelectFileB}
        onLoadSampleFiles={onLoadSampleFiles}
      />

      {/* Barra Superior / Header FoxBox */}
      <header className="h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between z-40 shadow-2xs">
        {/* Identificação do Projeto & Botões de Ação */}
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200/80 shadow-2xs transition-colors"
              title="Retornar ao Dashboard"
            >
              <span>←</span>
              <span>Painel</span>
            </button>
          )}

          <div className="flex items-center gap-2 pl-1 border-l border-slate-100">
            <span className="w-1 h-4 bg-indigo-600 rounded-full inline-block" />
            <div>
              <h2 className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[220px]">
                {projectName}
              </h2>
              <p className="text-[11px] text-slate-400">Inspeção & Comparação Técnica</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 text-xs font-semibold text-indigo-700 shadow-2xs transition-all"
            title="Subir novos PDFs para comparação"
          >
            <span>📂</span>
            <span>Subir / Trocar PDFs</span>
          </button>
        </div>

        {/* Seletor de Ferramentas Centrais (Estilo Pílula FoxBox) */}
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/50 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTool === 'select'
                ? 'bg-white text-indigo-600 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Navegar com a mãozinha (arraste a prancheta). Atalho: segure a barra de Espaço."
          >
            <span>✋</span> Mãozinha (Pan)
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('measure')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTool === 'measure'
                ? 'bg-white text-indigo-600 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📏</span> Medição (mm)
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('annotate')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTool === 'annotate'
                ? 'bg-white text-indigo-600 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>💬</span> Anotações
            {annotations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                {annotations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('diff')}
            disabled={!comparisonPdf}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-40 ${
              activeTool === 'diff'
                ? 'bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-600/30'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title={!comparisonPdf ? 'Carregue a Versão B no modal para comparar' : 'Comparar versões (Diff)'}
          >
            <span>⚡</span> Comparar Versões
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('cmyk')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTool === 'cmyk'
                ? 'bg-white text-indigo-600 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🎨</span> Chapas CMYK
          </button>
        </div>

        {/* Controles da Direita: Alternância A/B, Paginação e Zoom */}
        <div className="flex items-center gap-3">
          {/* Alternância A / B */}
          {activeTool !== 'diff' && comparisonPdf && (
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50 text-xs">
              <button
                type="button"
                onClick={() => setViewDocument('A')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  viewDocument === 'A'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ver A
              </button>
              <button
                type="button"
                onClick={() => setViewDocument('B')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  viewDocument === 'B'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ver B
              </button>
            </div>
          )}

          {/* Paginação */}
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-slate-200/80 text-xs shadow-2xs">
            <button
              onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
              disabled={pageNumber <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              ◀
            </button>
            <span className="text-slate-700 font-mono font-bold px-1">
              {pageNumber} / {currentNumPages}
            </span>
            <button
              onClick={() => setPageNumber((p) => Math.min(p + 1, currentNumPages))}
              disabled={pageNumber >= currentNumPages}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              ▶
            </button>
          </div>

          {/* Zoom e Reset com Centralização */}
          <div className="flex items-center gap-0.5 bg-white p-1 rounded-xl border border-slate-200/80 text-xs shadow-2xs">
            <button
              onClick={handleZoomOut}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 font-bold"
              title="Reduzir zoom (-)"
            >
              -
            </button>
            <button
              onClick={handleResetZoomAndPan}
              className="px-2 font-mono font-semibold text-slate-700 hover:text-indigo-600"
              title="Centralizar e resetar zoom para 100%"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 font-bold"
              title="Aumentar zoom (+)"
            >
              +
            </button>
          </div>

          {/* Botão de Centralizar Prancheta se estiver deslocado */}
          {(panPosition.x !== 0 || panPosition.y !== 0) && (
            <button
              type="button"
              onClick={() => setPanPosition({ x: 0, y: 0 })}
              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] border border-indigo-100 transition-colors"
              title="Voltar ao centro"
            >
              Centralizar
            </button>
          )}
        </div>
      </header>

      {/* Área Central de Visualização (Mesa de Luz com Suporte a Pan/Mãozinha) */}
      <main
        onPointerDown={handlePointerDownPan}
        onPointerMove={handlePointerMovePan}
        onPointerUp={handlePointerUpPan}
        onWheel={handleWheel}
        className={`flex-1 overflow-hidden bg-[#f8fafc] p-8 flex justify-center items-center relative ${
          canPan
            ? isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : ''
        }`}
      >
        {(!primaryPdf) && (
          <div className="flex flex-col items-center justify-center text-center max-w-md bg-white p-8 rounded-3xl border border-slate-100 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl mb-3 font-bold">
              📦
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Nenhum arquivo selecionado</h2>
            <p className="text-xs text-slate-500 mb-5">
              Selecione ou faça upload de dois PDFs para iniciar a inspeção e comparação técnica no ecossistema FoxBox.
            </p>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/30 transition-all"
            >
              Selecionar Arquivos PDF
            </button>
          </div>
        )}

        {(loadingA || loadingB) && (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Renderizando documento vetorial em alta nitidez...</p>
          </div>
        )}

        {(errorA || errorB) && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs max-w-md shadow-xs">
            <p className="font-bold mb-1">Falha no carregamento:</p>
            <p className="text-rose-600">{errorA || errorB}</p>
          </div>
        )}

        {/* CONTAINER DA PRANCHETA (Transladado com o Pan da Mãozinha) */}
        {(activeDoc || (activeIsImage && activeFile?.url)) && (
          <div
            style={{
              transform: `translate3d(${panPosition.x}px, ${panPosition.y}px, 0px)`,
              willChange: 'transform',
            }}
            className="transition-transform duration-75 ease-out select-none"
          >
            {/* Exibição em Modo Diff (Universal: PDF vs PDF, Img vs Img ou PDF vs Img) */}
            {activeTool === 'diff' && primaryPdf && comparisonPdf && (
              <PdfDiffViewer
                pdfDocA={isImageA ? null : primaryDoc}
                imageUrlA={primaryPdf.url}
                isImageA={isImageA}
                pdfDocB={isImageB ? null : comparisonDoc}
                imageUrlB={comparisonPdf.url}
                isImageB={isImageB}
                pageNumber={pageNumber}
                scale={scale}
              />
            )}

            {/* Exibição em Modo Chapas CMYK (PDF ou Imagem JPG/PNG) */}
            {activeTool === 'cmyk' && (
              <CmykViewer
                pdfDoc={activeIsImage ? null : activeDoc}
                imageUrl={activeFile?.url}
                isImage={activeIsImage}
                pageNumber={pageNumber}
                scale={scale}
              />
            )}

            {/* Visualização Normal (Canvas + Medição + Anotações) */}
            {activeTool !== 'diff' && activeTool !== 'cmyk' && (
              <div className="relative inline-block select-none shadow-xl rounded-lg overflow-hidden border border-slate-200/80 bg-white">
                {/* Camada 1: Canvas de Renderização Universal (PDF ou JPG/PNG) */}
                <DocumentCanvas
                  pdfDoc={activeIsImage ? null : activeDoc}
                  imageUrl={activeFile?.url}
                  isImage={activeIsImage}
                  pageNumber={pageNumber}
                  scale={scale}
                  onDimensionsChange={handleDimensionsChange}
                />

                {/* Camada 2: Régua e Medição Euclidiana em Milímetros */}
                <MeasurementLayer
                  width={canvasDimensions.width}
                  height={canvasDimensions.height}
                  scale={scale}
                  isActive={activeTool === 'measure'}
                />

                {/* Camada 3: Anotações com Coordenadas Percentuais */}
                <AnnotationLayer
                  width={canvasDimensions.width}
                  height={canvasDimensions.height}
                  isActive={activeTool === 'annotate'}
                  annotations={annotations}
                  onAddAnnotation={handleAddAnnotation}
                  onUpdateStatus={handleUpdateStatus}
                />
              </div>
            )}
          </div>
        )}

        {/* Dica discreta de navegação no rodapé */}
        <div className="absolute bottom-4 left-6 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 shadow-2xs pointer-events-none flex items-center gap-2">
          <span>💡 <strong>Dica:</strong> Segure a tecla <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200">Espaço</kbd> ou clique com a <strong>✋ Mãozinha</strong> para arrastar a embalagem. <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200">Ctrl + Scroll</kbd> para zoom.</span>
        </div>
      </main>
    </div>
  );
};
