import React, { useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadImageElement } from '../../utils/fileTypes';

interface DocumentCanvasProps {
  pdfDoc: PDFDocumentProxy | null;
  imageUrl?: string | null;
  isImage?: boolean;
  pageNumber: number;
  scale: number;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}

/**
 * Renderizador Universal de Documentos Técnicos (PDF, JPG, PNG, WEBP).
 * 
 * Mantém máxima fidelidade gráfica e suporte a telas HiDPI/Retina:
 * - Para PDFs: Renderiza vetorialmente com o worker do PDF.js.
 * - Para Imagens (JPG/PNG): Desenha o bitmap com suavização bicúbica e escala adaptada.
 */
export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  pdfDoc,
  imageUrl,
  isImage = false,
  pageNumber,
  scale,
  onDimensionsChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderTask = useRef<RenderTask | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isCancelled = false;

    // 1. RENDERIZAÇÃO DE IMAGEM (JPG / PNG)
    if (isImage && imageUrl) {
      loadImageElement(imageUrl)
        .then((img) => {
          if (isCancelled) return;

          const context = canvas.getContext('2d', { alpha: false });
          if (!context) return;

          const dpr = window.devicePixelRatio || 1;

          // Tamanho visual escalado (CSS pixels)
          // Normaliza imagens grandes para caber confortavelmente na mesa de luz (base 800px)
          const baseScale = img.naturalWidth > 1200 ? 800 / img.naturalWidth : 1;
          const cssWidth = Math.floor(img.naturalWidth * baseScale * scale);
          const cssHeight = Math.floor(img.naturalHeight * baseScale * scale);

          // Buffer físico interno
          canvas.width = Math.floor(cssWidth * dpr);
          canvas.height = Math.floor(cssHeight * dpr);

          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;

          onDimensionsChange?.({ width: cssWidth, height: cssHeight });

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        })
        .catch((err) => {
          console.error('[DocumentCanvas] Erro ao carregar imagem JPG/PNG:', err);
        });

      return () => {
        isCancelled = true;
      };
    }

    // 2. RENDERIZAÇÃO DE PDF VETORIAL
    if (pdfDoc) {
      if (currentRenderTask.current) {
        currentRenderTask.current.cancel();
        currentRenderTask.current = null;
      }

      pdfDoc.getPage(pageNumber).then((page) => {
        if (isCancelled) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });

        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);

        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);

        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        onDimensionsChange?.({ width: cssWidth, height: cssHeight });

        const transform: [number, number, number, number, number, number] = [
          dpr, 0,
          0, dpr,
          0, 0
        ];

        const renderContext = {
          canvasContext: context,
          transform,
          viewport,
        };

        const renderTask = page.render(renderContext as any);
        currentRenderTask.current = renderTask;

        renderTask.promise
          .then(() => {
            currentRenderTask.current = null;
          })
          .catch((error: any) => {
            if (error?.name !== 'RenderingCancelledException') {
              console.error('[DocumentCanvas] Erro ao renderizar PDF:', error);
            }
          });
      });

      return () => {
        isCancelled = true;
        if (currentRenderTask.current) {
          currentRenderTask.current.cancel();
        }
      };
    }
  }, [pdfDoc, imageUrl, isImage, pageNumber, scale, onDimensionsChange]);

  return (
    <canvas
      ref={canvasRef}
      className="shadow-2xl rounded-sm bg-white block select-none"
    />
  );
};
