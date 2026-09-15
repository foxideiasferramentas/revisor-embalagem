import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadImageElement } from '../../utils/fileTypes';

interface CmykViewerProps {
  isActive?: boolean;
  pdfDoc: PDFDocumentProxy | null;
  imageUrl?: string | null;
  isImage?: boolean;
  pageNumber: number;
  scale: number;
}

interface ChannelState {
  enabled: boolean;
  opacity: number; // 0 a 1
}

type ViewMode = 'composite' | 'film'; // 'composite' = mistura real das tintas; 'film' = escala de cinza/fotolito

/**
 * Separador Técnico de Chapas Gráficas CMYK em Tempo Real.
 * 
 * Converte a arte do PDF (espaço RGB) para o modelo substrativo CMYK:
 * - K = 1 - max(R, G, B)
 * - C = (1 - R - K) / (1 - K)
 * - M = (1 - G - K) / (1 - K)
 * - Y = (1 - B - K) / (1 - K)
 * 
 * Permite ligar, desligar e dosar cada uma das 4 chapas de impressão offset/flexo,
 * além de inspecionar o filme/fotolito individual em alta definição.
 */
export const CmykViewer: React.FC<CmykViewerProps> = ({
  isActive = true,
  pdfDoc,
  imageUrl,
  isImage = false,
  pageNumber,
  scale,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Estados dos canais CMYK
  const [channels, setChannels] = useState<{
    c: ChannelState;
    m: ChannelState;
    y: ChannelState;
    k: ChannelState;
  }>({
    c: { enabled: true, opacity: 1 },
    m: { enabled: true, opacity: 1 },
    y: { enabled: true, opacity: 1 },
    k: { enabled: true, opacity: 1 },
  });

  const [viewMode, setViewMode] = useState<ViewMode>('composite');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isMagnifierActive, setIsMagnifierActive] = useState<boolean>(false);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 1100,
  });

  // Buffers de canais desmembrados em memória (Float32Array para performance máxima)
  const cmykBufferRef = useRef<{
    c: Float32Array;
    m: Float32Array;
    y: Float32Array;
    k: Float32Array;
    alpha: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);

  // 1. Renderiza a página do PDF ou Imagem e calcula os canais CMYK
  useEffect(() => {
    const hasDoc = (isImage && imageUrl) || pdfDoc;
    if (!hasDoc) return;

    let isCancelled = false;
    setIsProcessing(true);

    const renderAndDecompose = async () => {
      try {
        let width = 800;
        let height = 1100;
        let loadedImg: HTMLImageElement | null = null;
        let page: any = null;
        let viewport: any = null;

        if (isImage && imageUrl) {
          loadedImg = await loadImageElement(imageUrl);
          if (isCancelled) return;
          const baseScale = loadedImg.naturalWidth > 1200 ? 800 / loadedImg.naturalWidth : 1;
          width = Math.floor(loadedImg.naturalWidth * baseScale * scale);
          height = Math.floor(loadedImg.naturalHeight * baseScale * scale);
        } else if (pdfDoc) {
          const targetPage = Math.min(pageNumber, pdfDoc.numPages);
          page = await pdfDoc.getPage(targetPage);
          if (isCancelled) return;
          viewport = page.getViewport({ scale });
          width = Math.floor(viewport.width);
          height = Math.floor(viewport.height);
        }

        setDimensions({ width, height });

        // Canvas temporário em memória para extração de dados
        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
        if (!offCtx) return;

        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, width, height);

        if (loadedImg) {
          offCtx.drawImage(loadedImg, 0, 0, width, height);
        } else if (page && viewport) {
          await page.render({ canvasContext: offCtx, viewport } as any).promise;
        }

        if (isCancelled) return;

        const imgData = offCtx.getImageData(0, 0, width, height);
        const pixels = imgData.data;
        const totalPixels = width * height;

        const cArr = new Float32Array(totalPixels);
        const mArr = new Float32Array(totalPixels);
        const yArr = new Float32Array(totalPixels);
        const kArr = new Float32Array(totalPixels);
        const alphaArr = new Uint8ClampedArray(totalPixels);

        // Decomposição RGB -> CMYK pixel a pixel
        for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
          const r = pixels[i] / 255;
          const g = pixels[i + 1] / 255;
          const b = pixels[i + 2] / 255;
          alphaArr[p] = pixels[i + 3];

          // Canal Preto (Key)
          const k = 1 - Math.max(r, g, b);
          kArr[p] = k;

          if (k >= 0.999) {
            cArr[p] = 0;
            mArr[p] = 0;
            yArr[p] = 0;
          } else {
            const invK = 1 - k;
            cArr[p] = (1 - r - k) / invK;
            mArr[p] = (1 - g - k) / invK;
            yArr[p] = (1 - b - k) / invK;
          }
        }

        cmykBufferRef.current = {
          c: cArr,
          m: mArr,
          y: yArr,
          k: kArr,
          alpha: alphaArr,
          width,
          height,
        };

        // Renderiza na tela
        updateCanvasDisplay();
      } catch (err) {
        console.error('[CmykViewer] Erro ao separar canais CMYK:', err);
      } finally {
        if (!isCancelled) {
          setIsProcessing(false);
        }
      }
    };

    renderAndDecompose();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, imageUrl, isImage, pageNumber, scale]);

  // 2. Reconstroi a imagem no canvas com base nas chapas ativas
  const updateCanvasDisplay = useCallback(() => {
    const buffer = cmykBufferRef.current;
    const canvas = canvasRef.current;
    if (!buffer || !canvas) return;

    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(buffer.width, buffer.height);
    const data = imgData.data;
    const totalPixels = buffer.width * buffer.height;

    const { c: cState, m: mState, y: yState, k: kState } = channels;

    const cFactor = cState.enabled ? cState.opacity : 0;
    const mFactor = mState.enabled ? mState.opacity : 0;
    const yFactor = yState.enabled ? yState.opacity : 0;
    const kFactor = kState.enabled ? kState.opacity : 0;

    if (viewMode === 'composite') {
      // Reconstituição da impressão combinada
      for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
        const cVal = buffer.c[p] * cFactor;
        const mVal = buffer.m[p] * mFactor;
        const yVal = buffer.y[p] * yFactor;
        const kVal = buffer.k[p] * kFactor;

        // Converte de volta para RGB
        const invK = 1 - kVal;
        data[i] = Math.round(255 * (1 - cVal) * invK);     // R
        data[i + 1] = Math.round(255 * (1 - mVal) * invK); // G
        data[i + 2] = Math.round(255 * (1 - yVal) * invK); // B
        data[i + 3] = buffer.alpha[p];                     // A
      }
    } else {
      // Modo Filme/Fotolito (P/B / Densidade de Retícula da chapa isolada)
      for (let p = 0, i = 0; p < totalPixels; p++, i += 4) {
        let density = 0;
        if (cFactor > 0) density += buffer.c[p] * cFactor;
        if (mFactor > 0) density += buffer.m[p] * mFactor;
        if (yFactor > 0) density += buffer.y[p] * yFactor;
        if (kFactor > 0) density += buffer.k[p] * kFactor;

        density = Math.min(density, 1);
        const gray = Math.round(255 * (1 - density));

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        data[i + 3] = buffer.alpha[p];
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [channels, viewMode]);

  // Atualiza sempre que os canais ou o modo de exibição mudam
  useEffect(() => {
    updateCanvasDisplay();
  }, [updateCanvasDisplay]);

  // Ações de canal
  const toggleChannel = (key: keyof typeof channels) => {
    setChannels((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
  };

  const updateOpacity = (key: keyof typeof channels, opacity: number) => {
    setChannels((prev) => ({
      ...prev,
      [key]: { ...prev[key], opacity },
    }));
  };

  const selectOnlyChannel = (key: keyof typeof channels) => {
    setChannels({
      c: { enabled: key === 'c', opacity: 1 },
      m: { enabled: key === 'm', opacity: 1 },
      y: { enabled: key === 'y', opacity: 1 },
      k: { enabled: key === 'k', opacity: 1 },
    });
  };

  const enableAllChannels = () => {
    setChannels({
      c: { enabled: true, opacity: 1 },
      m: { enabled: true, opacity: 1 },
      y: { enabled: true, opacity: 1 },
      k: { enabled: true, opacity: 1 },
    });
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Painel de Controle de Chapas CMYK - Fixo no Topo (Imune a Pan/Zoom) */}
      {isActive && createPortal(
        <div className="fixed top-20 left-0 right-0 flex justify-center z-40 pointer-events-none px-6">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-5 max-w-5xl w-full text-xs animate-in fade-in slide-in-from-top-2 duration-150">
        {/* Identificação e Modo de Visualização */}
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-3.5 bg-indigo-600 rounded-full inline-block" />
            <span className="font-bold text-slate-800 tracking-tight">
              Chapas Técnicas
            </span>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
            <button
              type="button"
              onClick={() => setViewMode('composite')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'composite'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Sobreposição das tintas ativas"
            >
              Cores Reais
            </button>
            <button
              type="button"
              onClick={() => setViewMode('film')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'film'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Densidade monocromática (fotolito/chapa de alumínio)"
            >
              Filme P/B
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => setIsMagnifierActive(!isMagnifierActive)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                isMagnifierActive
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Inspecionar Retícula (Lupa 5x)"
            >
              <span>🔎</span> Lupa
            </button>
          </div>
        </div>

        {/* Controles das 4 Chapas Gráficas */}
        <div className="flex flex-wrap items-center gap-4">
          {/* CHAPA CIANO */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleChannel('c')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                channels.c.enabled
                  ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-cyan-600/20" />
              Ciano (C)
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={channels.c.opacity}
              disabled={!channels.c.enabled}
              onChange={(e) => updateOpacity('c', parseFloat(e.target.value))}
              className="w-14 accent-cyan-600 cursor-pointer disabled:opacity-30"
              title="Densidade da tinta ciano"
            />
          </div>

          {/* CHAPA MAGENTA */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleChannel('m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                channels.m.enabled
                  ? 'bg-pink-50 text-pink-700 border border-pink-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 border border-pink-600/20" />
              Magenta (M)
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={channels.m.opacity}
              disabled={!channels.m.enabled}
              onChange={(e) => updateOpacity('m', parseFloat(e.target.value))}
              className="w-14 accent-pink-600 cursor-pointer disabled:opacity-30"
              title="Densidade da tinta magenta"
            />
          </div>

          {/* CHAPA AMARELO */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleChannel('y')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                channels.y.enabled
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500/20" />
              Amarelo (Y)
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={channels.y.opacity}
              disabled={!channels.y.enabled}
              onChange={(e) => updateOpacity('y', parseFloat(e.target.value))}
              className="w-14 accent-amber-500 cursor-pointer disabled:opacity-30"
              title="Densidade da tinta amarela"
            />
          </div>

          {/* CHAPA PRETO */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleChannel('k')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                channels.k.enabled
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-black border border-white/20" />
              Preto (K)
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={channels.k.opacity}
              disabled={!channels.k.enabled}
              onChange={(e) => updateOpacity('k', parseFloat(e.target.value))}
              className="w-14 accent-slate-800 cursor-pointer disabled:opacity-30"
              title="Densidade da tinta preta"
            />
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
          <button
            type="button"
            onClick={enableAllChannels}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px]"
            title="Ativa todas as 4 chapas"
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => selectOnlyChannel('c')}
            className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 font-bold text-[11px]"
            title="Isolar Chapa Ciano"
          >
            Só C
          </button>
          <button
            type="button"
            onClick={() => selectOnlyChannel('m')}
            className="px-2 py-1 rounded-lg bg-pink-50 text-pink-700 hover:bg-pink-100 font-bold text-[11px]"
            title="Isolar Chapa Magenta"
          >
            Só M
          </button>
          <button
            type="button"
            onClick={() => selectOnlyChannel('y')}
            className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-[11px]"
            title="Isolar Chapa Amarelo"
          >
            Só Y
          </button>
          <button
            type="button"
            onClick={() => selectOnlyChannel('k')}
            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold text-[11px]"
            title="Isolar Chapa Preto"
          >
            Só K
          </button>
        </div>
      </div>
    </div>,
    document.body
  )}

      {/* Exibição da Arte Separada no Canvas */}
      <div 
        className={`relative shadow-xl rounded-2xl bg-white overflow-hidden border border-slate-200/80 ${isMagnifierActive ? 'cursor-crosshair' : ''}`}
        onPointerMove={(e) => {
          if (!isMagnifierActive) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setMagnifierPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
      >
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-30">
            {/* Skeleton Loading simulando prancheta */}
            <div className="w-48 h-64 bg-slate-200/60 animate-pulse rounded-xl mb-6 shadow-inner border border-slate-300/50" />
            
            <div className="flex items-center gap-3 text-indigo-700 font-bold text-xs bg-indigo-50 px-4 py-2.5 rounded-xl border border-indigo-100 shadow-sm">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Processando chapas CMYK em alta definição...
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: dimensions.width, height: dimensions.height }}
          className="block select-none"
        />

        {/* Lupa Renderizada em cima do canvas */}
        {isMagnifierActive && !isProcessing && (
          <div
            className="absolute rounded-full border-4 border-white shadow-[0_5px_20px_rgba(0,0,0,0.3)] pointer-events-none z-20 bg-white"
            style={{
              width: 200,
              height: 200,
              left: magnifierPos.x - 100,
              top: magnifierPos.y - 100,
              backgroundImage: canvasRef.current ? `url(${canvasRef.current.toDataURL()})` : 'none',
              backgroundPosition: `-${magnifierPos.x * 5 - 100}px -${magnifierPos.y * 5 - 100}px`,
              backgroundSize: `${dimensions.width * 5}px ${dimensions.height * 5}px`,
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* Mira central */}
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 bg-rose-500 rounded-full" />
            <div className="absolute top-1/2 left-1/2 w-8 h-px -translate-x-1/2 -translate-y-1/2 bg-rose-500/30" />
            <div className="absolute top-1/2 left-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-rose-500/30" />
          </div>
        )}
      </div>
    </div>
  );
};
