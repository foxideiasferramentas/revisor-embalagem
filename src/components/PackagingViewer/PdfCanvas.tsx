import React, { useEffect, useRef } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

interface PdfCanvasProps {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  scale: number;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}

/**
 * Componente responsável pela renderização nítida de páginas PDF via Canvas API.
 * 
 * Estratégia de Nitidez (HiDPI / Retina):
 * 1. Calcula o devicePixelRatio do dispositivo (ex: 2x em telas Retina).
 * 2. Define o buffer interno do canvas (canvas.width / canvas.height) multiplicado pelo DPR.
 * 3. Mantém o tamanho visual no CSS (style.width / style.height) exatamente no tamanho do viewport.
 * 4. Aplica scale(dpr, dpr) no contexto 2D para renderização vetorial ultranítida.
 */
export const PdfCanvas: React.FC<PdfCanvasProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  onDimensionsChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderTask = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    // Cancela qualquer tarefa de renderização anterior que ainda esteja executando
    if (currentRenderTask.current) {
      currentRenderTask.current.cancel();
      currentRenderTask.current = null;
    }

    pdfDoc.getPage(pageNumber).then((page) => {
      if (isCancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      // Obtém a proporção de pixels físicos da tela (padrão 1, telas retina 2 ou superior)
      const dpr = window.devicePixelRatio || 1;

      // Viewport com o zoom desejado
      const viewport = page.getViewport({ scale });

      // Tamanho visual na página (CSS pixels)
      const cssWidth = Math.floor(viewport.width);
      const cssHeight = Math.floor(viewport.height);

      // Tamanho real da memória/buffer gráfico (Physical pixels)
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);

      // Trava as dimensões CSS para que a tela não infle
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      // Notifica o componente pai sobre as dimensões visuais calculadas
      onDimensionsChange?.({ width: cssWidth, height: cssHeight });

      // Matriz de transformação para compensar a escala física do DPR
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
          // Erros de cancelamento de renderização são esperados quando o usuário altera o zoom
          if (error?.name !== 'RenderingCancelledException') {
            console.error('[PdfCanvas] Erro ao renderizar página:', error);
          }
        });
    });

    return () => {
      isCancelled = true;
      if (currentRenderTask.current) {
        currentRenderTask.current.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale, onDimensionsChange]);

  return (
    <canvas
      ref={canvasRef}
      className="shadow-2xl rounded-sm transition-shadow duration-300 bg-white block select-none"
    />
  );
};
