import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pixelmatch from 'pixelmatch';
import { loadImageElement } from '../../utils/fileTypes';

export type DiffVisualMode = 'diff' | 'wipe' | 'side-by-side' | 'flash';

interface PdfDiffViewerProps {
  pdfDocA: PDFDocumentProxy | null;
  imageUrlA?: string | null;
  isImageA?: boolean;
  pdfDocB: PDFDocumentProxy | null;
  imageUrlB?: string | null;
  isImageB?: boolean;
  pageNumber: number;
  scale: number;
}

/**
 * Componente Avançado de Comparação Técnica de Versões de Embalagens.
 * 
 * Recursos de Alinhamento Proporcional:
 * - Auto-Fit Proporcional: Iguala a escala da Versão B à Versão A sem stretch (preserva proporção 1:1).
 * - Controle manual fino de escala da Versão B (50% a 300%).
 * - Controle de deslocamento milimétrico (Offset X e Y) para compensar sangrias ou margens diferentes.
 */
export const PdfDiffViewer: React.FC<PdfDiffViewerProps> = ({
  pdfDocA,
  imageUrlA,
  isImageA = false,
  pdfDocB,
  imageUrlB,
  isImageB = false,
  pageNumber,
  scale,
}) => {
  const visibleDiffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados de Imagem Renderizada
  const [renderedUrlA, setRenderedUrlA] = useState<string | null>(null);
  const [renderedUrlB, setRenderedUrlB] = useState<string | null>(null);

  const [diffStats, setDiffStats] = useState<{ totalMismatched: number; diffPercentage: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(0.1);
  const [visualMode, setVisualMode] = useState<DiffVisualMode>('wipe');
  
  // Controle para o modo Cortina (0 a 100%)
  const [wipePosition, setWipePosition] = useState<number>(50);
  const [isDraggingWipe, setIsDraggingWipe] = useState<boolean>(false);

  // Controle para o modo Flash / Opacidade
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.5);
  const [isAutoFlashing, setIsAutoFlashing] = useState<boolean>(false);

  // Controles de Calibração e Escala Proporcional da Versão B (Sem Stretch)
  const [scaleMultiplierB, setScaleMultiplierB] = useState<number>(1.0);
  const [offsetB, setOffsetB] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoMatchScale, setAutoMatchScale] = useState<boolean>(true);
  const [showAlignControls, setShowAlignControls] = useState<boolean>(true);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 1100,
  });

  // Efeito universal de renderização, calibração proporcional e cálculo do Diff
  useEffect(() => {
    const hasA = (isImageA && imageUrlA) || pdfDocA;
    const hasB = (isImageB && imageUrlB) || pdfDocB;
    if (!hasA || !hasB) return;

    let isCancelled = false;
    setIsProcessing(true);

    const runRenderAndDiff = async () => {
      try {
        let widthA = 800;
        let heightA = 1100;
        let rawWidthB = 800;
        let rawHeightB = 1100;

        let loadedImgA: HTMLImageElement | null = null;
        let loadedImgB: HTMLImageElement | null = null;
        let pageA: any = null;
        let pageB: any = null;
        let viewportA: any = null;

        // 1. Obtém dimensões nativas do documento A
        if (isImageA && imageUrlA) {
          loadedImgA = await loadImageElement(imageUrlA);
          if (isCancelled) return;
          const baseScaleA = loadedImgA.naturalWidth > 1200 ? 800 / loadedImgA.naturalWidth : 1;
          widthA = Math.floor(loadedImgA.naturalWidth * baseScaleA * scale);
          heightA = Math.floor(loadedImgA.naturalHeight * baseScaleA * scale);
        } else if (pdfDocA) {
          const targetPageA = Math.min(pageNumber, pdfDocA.numPages);
          pageA = await pdfDocA.getPage(targetPageA);
          if (isCancelled) return;
          viewportA = pageA.getViewport({ scale });
          widthA = Math.floor(viewportA.width);
          heightA = Math.floor(viewportA.height);
        }

        // 2. Obtém dimensões nativas do documento B
        if (isImageB && imageUrlB) {
          loadedImgB = await loadImageElement(imageUrlB);
          if (isCancelled) return;
          const baseScaleB = loadedImgB.naturalWidth > 1200 ? 800 / loadedImgB.naturalWidth : 1;
          rawWidthB = Math.floor(loadedImgB.naturalWidth * baseScaleB * scale);
          rawHeightB = Math.floor(loadedImgB.naturalHeight * baseScaleB * scale);
        } else if (pdfDocB) {
          const targetPageB = Math.min(pageNumber, pdfDocB.numPages);
          pageB = await pdfDocB.getPage(targetPageB);
          if (isCancelled) return;
          const baseViewportB = pageB.getViewport({ scale });
          rawWidthB = Math.floor(baseViewportB.width);
          rawHeightB = Math.floor(baseViewportB.height);
        }

        // 3. CALCULA A ESCALA PROPORCIONAL DE B (Sem Stretch!)
        // Se autoMatchScale estiver ativo, calcula o fator ideal para igualar a largura de A
        let proportionalRatio = 1.0;
        if (autoMatchScale && rawWidthB > 0) {
          proportionalRatio = widthA / rawWidthB;
        }

        // Fator final aplicado em B mantendo o aspect ratio estritamente bloqueado
        const finalScaleB = proportionalRatio * scaleMultiplierB;
        const renderWidthB = Math.round(rawWidthB * finalScaleB);
        const renderHeightB = Math.round(rawHeightB * finalScaleB);

        // 4. Área unificada da prancheta
        const width = Math.max(widthA, renderWidthB + Math.abs(offsetB.x));
        const height = Math.max(heightA, renderHeightB + Math.abs(offsetB.y));

        setDimensions({ width, height });

        // Canvases em memória para renderização nítida
        const offscreenA = document.createElement('canvas');
        const offscreenB = document.createElement('canvas');
        offscreenA.width = width;
        offscreenA.height = height;
        offscreenB.width = width;
        offscreenB.height = height;

        const ctxA = offscreenA.getContext('2d', { willReadFrequently: true });
        const ctxB = offscreenB.getContext('2d', { willReadFrequently: true });
        if (!ctxA || !ctxB) return;

        ctxA.fillStyle = '#ffffff';
        ctxA.fillRect(0, 0, width, height);
        ctxB.fillStyle = '#ffffff';
        ctxB.fillRect(0, 0, width, height);

        // Renderiza A
        if (loadedImgA) {
          ctxA.drawImage(loadedImgA, 0, 0, widthA, heightA);
        } else if (pageA && viewportA) {
          await pageA.render({ canvasContext: ctxA, viewport: viewportA } as any).promise;
        }

        // Renderiza B (Com a escala proporcional calculada e offset)
        if (loadedImgB) {
          ctxB.drawImage(loadedImgB, offsetB.x, offsetB.y, renderWidthB, renderHeightB);
        } else if (pageB) {
          // Para PDF, renderiza no viewport escalado proporcionalmente
          const scaledViewportB = pageB.getViewport({ scale: scale * finalScaleB });
          ctxB.save();
          ctxB.translate(offsetB.x, offsetB.y);
          await pageB.render({ canvasContext: ctxB, viewport: scaledViewportB } as any).promise;
          ctxB.restore();
        }

        if (isCancelled) return;

        // Salva Data URLs imutáveis de A e B
        const dataA = offscreenA.toDataURL('image/png');
        const dataB = offscreenB.toDataURL('image/png');
        setRenderedUrlA(dataA);
        setRenderedUrlB(dataB);

        // Executa o Pixelmatch nos buffers calibrados
        const imgDataA = ctxA.getImageData(0, 0, width, height);
        const imgDataB = ctxB.getImageData(0, 0, width, height);

        if (visibleDiffCanvasRef.current) {
          visibleDiffCanvasRef.current.width = width;
          visibleDiffCanvasRef.current.height = height;
          const ctxDiff = visibleDiffCanvasRef.current.getContext('2d');
          if (ctxDiff) {
            const diffImgData = ctxDiff.createImageData(width, height);

            const mismatchedPixels = pixelmatch(
              imgDataA.data,
              imgDataB.data,
              diffImgData.data,
              width,
              height,
              {
                threshold,
                includeAA: false,
                diffColor: [255, 0, 85],
                diffColorAlt: [0, 180, 255],
                alpha: 0.15,
              }
            );

            ctxDiff.putImageData(diffImgData, 0, 0);

            const totalPixels = width * height;
            const percentage = Number(((mismatchedPixels / totalPixels) * 100).toFixed(2));

            setDiffStats({
              totalMismatched: mismatchedPixels,
              diffPercentage: percentage,
            });
          }
        }
      } catch (err) {
        console.error('[PdfDiffViewer] Falha ao processar comparação com escala proporcional:', err);
      } finally {
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    };

    runRenderAndDiff();

    return () => {
      isCancelled = true;
    };
  }, [
    pdfDocA,
    imageUrlA,
    isImageA,
    pdfDocB,
    imageUrlB,
    isImageB,
    pageNumber,
    scale,
    threshold,
    autoMatchScale,
    scaleMultiplierB,
    offsetB,
  ]);

  // Efeito de auto-flash estroboscópico
  useEffect(() => {
    if (!isAutoFlashing) return;
    const interval = setInterval(() => {
      setOverlayOpacity((prev) => (prev > 0.5 ? 0 : 1));
    }, 500);
    return () => clearInterval(interval);
  }, [isAutoFlashing]);

  // Manipuladores de arraste da cortina
  const handleWipePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingWipe(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateWipeFromPointer(e);
  };

  const handleWipePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWipe) return;
    updateWipeFromPointer(e);
  };

  const handleWipePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingWipe(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const updateWipeFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setWipePosition(Number(((x / rect.width) * 100).toFixed(2)));
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Barra de Ferramentas Fixa no Topo (Imune a Pan/Zoom) */}
      {createPortal(
        <div className="fixed top-20 left-0 right-0 flex flex-col items-center z-40 pointer-events-none px-6">
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-4 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-slate-200/90 shadow-lg max-w-5xl w-full text-xs animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Seletor de Modo de Comparação */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 shadow-inner">
              <button
                type="button"
                onClick={() => setVisualMode('wipe')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  visualMode === 'wipe'
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>↔️</span> Cortina (Wipe)
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('diff')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  visualMode === 'diff'
                    ? 'bg-rose-500 text-white shadow-xs shadow-rose-500/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🔥</span> Destaque Neon (Diff)
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('side-by-side')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  visualMode === 'side-by-side'
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>◫</span> Lado a Lado
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('flash')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  visualMode === 'flash'
                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⚡</span> Sobreposição / Flash
              </button>
            </div>

            {/* Controles de Escala Proporcional e Ajuste de Alinhamento */}
            <div className="flex items-center gap-3">
              {/* Botão de Auto-Ajuste Proporcional */}
              <button
                type="button"
                onClick={() => {
                  setAutoMatchScale(!autoMatchScale);
                  setScaleMultiplierB(1.0);
                  setOffsetB({ x: 0, y: 0 });
                }}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 border transition-all ${
                  autoMatchScale
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Ajusta a escala da Versão B proporcionalmente para igualar o tamanho de A sem distorção"
              >
                <span>📐</span>
                <span>Auto-Proporção: {autoMatchScale ? 'Ligada' : 'Desligada'}</span>
              </button>

              {/* Botão para Abrir Calibração Fina */}
              <button
                type="button"
                onClick={() => setShowAlignControls(!showAlignControls)}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1.5 ${
                  showAlignControls
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Ajuste fino de escala e deslocamento (Offset)"
              >
                <span>⚙️</span>
                <span>Calibrar Escala B</span>
              </button>

              {/* Controles de Modo (Wipe divisor ou Flash) */}
              {visualMode === 'wipe' && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <span className="text-slate-400 text-[11px]">Divisor:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={wipePosition}
                    onChange={(e) => setWipePosition(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-indigo-600 w-8">
                    {Math.round(wipePosition)}%
                  </span>
                </div>
              )}

              {visualMode === 'diff' && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <span className="text-slate-400 text-[11px]">Sensibilidade:</span>
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-16 accent-rose-500 cursor-pointer"
                    title="Ajuste a sensibilidade de tolerância a diferenças de cor"
                  />
                  {diffStats && (
                    <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                      diffStats.diffPercentage > 0
                        ? 'bg-rose-50 text-rose-600 border border-rose-100'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}>
                      {diffStats.diffPercentage}%
                    </span>
                  )}
                </div>
              )}

              {visualMode === 'flash' && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    className="w-24 accent-indigo-600 cursor-pointer"
                    title="Deslize entre Versão A e B"
                  />
                  <button
                    type="button"
                    onClick={() => setIsAutoFlashing(!isAutoFlashing)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {isAutoFlashing ? '⏸' : '▶'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Painel Flutuante de Calibração Fina de Escala Proporcional e Deslocamento */}
          {showAlignControls && (
            <div className="pointer-events-auto mt-2 bg-white/98 backdrop-blur-md p-3.5 rounded-2xl border border-indigo-100 shadow-xl flex flex-wrap items-center justify-between gap-4 max-w-5xl w-full text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Seção 1: Escala Proporcional Estrita (Sem Stretch) */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <span>🔍</span> Escala Versão B:
                  </span>
                  <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full text-[10px] border border-indigo-100">
                    Proporcional 1:1 (Sem Stretch)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setScaleMultiplierB((prev) => Math.max(Number((prev - 0.05).toFixed(2)), 0.2))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center transition-colors"
                    title="Diminuir tamanho da Versão B (-5%)"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.02"
                    value={scaleMultiplierB}
                    onChange={(e) => setScaleMultiplierB(parseFloat(e.target.value))}
                    className="w-32 accent-indigo-600 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setScaleMultiplierB((prev) => Math.min(Number((prev + 0.05).toFixed(2)), 4.0))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center transition-colors"
                    title="Aumentar tamanho da Versão B (+5%)"
                  >
                    +
                  </button>
                  <span className="font-mono font-bold text-indigo-600 w-14 text-center text-sm bg-indigo-50/60 py-0.5 rounded-md border border-indigo-100">
                    {Math.round(scaleMultiplierB * 100)}%
                  </span>
                </div>

                {/* Presets Rápidos de Escala */}
                <div className="flex items-center gap-1">
                  {[0.75, 1.0, 1.25, 1.5, 2.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setScaleMultiplierB(preset)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        Math.abs(scaleMultiplierB - preset) < 0.01
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {Math.round(preset * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Seção 2: Ajuste de Posição / Encaixe da Embalagem (Offset X e Y) */}
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <span className="font-bold text-slate-700">Encaixe / Posição:</span>
                
                {/* Pad direcional rápido */}
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOffsetB((prev) => ({ ...prev, x: prev.x - 10 }))}
                    className="w-6 h-6 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200 shadow-2xs"
                    title="Mover 10px para esquerda"
                  >
                    ◄
                  </button>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setOffsetB((prev) => ({ ...prev, y: prev.y - 10 }))}
                      className="w-6 h-5 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200 shadow-2xs text-[10px]"
                      title="Mover 10px para cima"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => setOffsetB((prev) => ({ ...prev, y: prev.y + 10 }))}
                      className="w-6 h-5 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200 shadow-2xs text-[10px]"
                      title="Mover 10px para baixo"
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffsetB((prev) => ({ ...prev, x: prev.x + 10 }))}
                    className="w-6 h-6 rounded bg-white hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-slate-200 shadow-2xs"
                    title="Mover 10px para direita"
                  >
                    ►
                  </button>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                  <span>X: {offsetB.x}px</span>
                  <span>•</span>
                  <span>Y: {offsetB.y}px</span>
                </div>

                {/* Botão de Resetar Calibração */}
                <button
                  type="button"
                  onClick={() => {
                    setAutoMatchScale(true);
                    setScaleMultiplierB(1.0);
                    setOffsetB({ x: 0, y: 0 });
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-colors flex items-center gap-1"
                  title="Reseta escala e alinhamento para o padrão"
                >
                  <span>↺</span> Resetar
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Área Central de Visualização */}
      <div className="relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-30 text-slate-700 text-xs font-semibold rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
            Igualando proporções e alinhando embalagens...
          </div>
        )}

        {/* 1. Modo CORTINA INTERATIVA (Wipe Slider Proporcional) */}
        {visualMode === 'wipe' && renderedUrlA && renderedUrlB && (
          <div
            style={{ width: dimensions.width, height: dimensions.height }}
            onPointerDown={handleWipePointerDown}
            onPointerMove={handleWipePointerMove}
            onPointerUp={handleWipePointerUp}
            className="relative shadow-xl rounded-2xl bg-white overflow-hidden border border-slate-200/80 cursor-ew-resize select-none"
          >
            {/* Camada B (Fundo - Agora na mesma proporção e escala de A!) */}
            <img
              src={renderedUrlB}
              alt="Versão B"
              style={{ width: dimensions.width, height: dimensions.height }}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none block"
            />

            {/* Camada A (Recortada) */}
            <div
              style={{ width: `${wipePosition}%` }}
              className="absolute inset-0 top-0 bottom-0 left-0 overflow-hidden border-r-2 border-indigo-600 shadow-[3px_0_15px_rgba(79,70,229,0.35)] pointer-events-none"
            >
              <img
                src={renderedUrlA}
                alt="Versão A"
                style={{ width: dimensions.width, height: dimensions.height, maxWidth: 'none' }}
                className="block pointer-events-none select-none"
              />
            </div>

            {/* Botão Flutuante do Divisor */}
            <div
              style={{ left: `${wipePosition}%` }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-lg pointer-events-none border-2 border-white transition-transform active:scale-110"
            >
              ↔
            </div>

            {/* Badges Indicadoras FoxBox */}
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-blue-600 font-bold text-[11px] px-3 py-1 rounded-full pointer-events-none border border-blue-100 shadow-xs">
              Versão A {isImageA ? '(Imagem)' : '(PDF)'}
            </div>
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-rose-500 font-bold text-[11px] px-3 py-1 rounded-full pointer-events-none border border-rose-100 shadow-xs">
              Versão B {isImageB ? '(Imagem)' : '(PDF)'} {autoMatchScale && '• Proporcional'}
            </div>
          </div>
        )}

        {/* 2. Modo DIFF com Pixelmatch */}
        <div className={visualMode === 'diff' ? 'block' : 'hidden'}>
          <div className="shadow-xl rounded-2xl bg-white overflow-hidden border border-slate-200/80">
            <canvas ref={visibleDiffCanvasRef} className="block select-none" />
          </div>
        </div>

        {/* 3. Modo LADO A LADO */}
        {visualMode === 'side-by-side' && renderedUrlA && renderedUrlB && (
          <div className="flex gap-6 items-start">
            <div className="flex flex-col items-center">
              <span className="mb-2 text-xs font-bold text-blue-600 uppercase tracking-wider bg-white px-3.5 py-1.5 rounded-full border border-blue-100 shadow-2xs">
                Versão A {isImageA ? '(Imagem)' : '(PDF)'}
              </span>
              <div className="shadow-xl rounded-2xl bg-white overflow-hidden border border-slate-200/80">
                <img
                  src={renderedUrlA}
                  alt="Versão A"
                  style={{ width: dimensions.width * 0.68, height: dimensions.height * 0.68 }}
                  className="block select-none object-contain"
                />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <span className="mb-2 text-xs font-bold text-rose-500 uppercase tracking-wider bg-white px-3.5 py-1.5 rounded-full border border-rose-100 shadow-2xs">
                Versão B {isImageB ? '(Imagem)' : '(PDF)'}
              </span>
              <div className="shadow-xl rounded-2xl bg-white overflow-hidden border border-slate-200/80">
                <img
                  src={renderedUrlB}
                  alt="Versão B"
                  style={{ width: dimensions.width * 0.68, height: dimensions.height * 0.68 }}
                  className="block select-none object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. Modo SOBREPOSIÇÃO / FLASH */}
        {visualMode === 'flash' && renderedUrlA && renderedUrlB && (
          <div
            style={{ width: dimensions.width, height: dimensions.height }}
            className="relative shadow-xl rounded-2xl bg-white overflow-hidden border border-slate-200/80 select-none"
          >
            {/* Imagem A */}
            <img
              src={renderedUrlA}
              alt="Versão A"
              style={{ width: dimensions.width, height: dimensions.height }}
              className="absolute inset-0 block w-full h-full object-contain pointer-events-none select-none"
            />

            {/* Imagem B */}
            <img
              src={renderedUrlB}
              alt="Versão B"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                opacity: overlayOpacity,
              }}
              className="absolute inset-0 block w-full h-full object-contain pointer-events-none select-none transition-opacity duration-100"
            />

            {/* Indicador de Transição no Canto */}
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs px-3 py-1 rounded-xl text-[11px] font-mono border border-slate-200/80 text-slate-700 pointer-events-none shadow-xs">
              A: <strong className="text-blue-600">{Math.round((1 - overlayOpacity) * 100)}%</strong> | B: <strong className="text-rose-500">{Math.round(overlayOpacity * 100)}%</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
