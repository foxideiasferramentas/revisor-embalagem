import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Configuração do Worker do PDF.js otimizada para Vite
// O Vite empacota workers nativamente quando importados com ?worker ou via new URL()
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  // Configuração compatível com ESM e bundlers modernos (Vite / Rollup)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

interface UsePdfLoaderResult {
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook customizado para carregar e gerenciar instâncias de documentos PDF com PDF.js
 * Garante liberação de memória (cleanup) e cancelamento de requisições pendentes.
 */
export function usePdfLoader(urlOrBuffer: string | Uint8Array | null): UsePdfLoaderResult {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Referência para cancelar loading anterior se a URL mudar no meio do caminho
  const loadingTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!urlOrBuffer) {
      setPdfDoc(null);
      setNumPages(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);
    setError(null);

    // Se já havia uma tarefa de carregamento em andamento, cancela
    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy();
    }

    const task = pdfjsLib.getDocument(
      typeof urlOrBuffer === 'string'
        ? { url: urlOrBuffer, cMapUrl: 'https://unpkg.com/pdfjs-dist/cmaps/', cMapPacked: true }
        : { data: urlOrBuffer }
    );
    loadingTaskRef.current = task;

    task.promise
      .then((doc) => {
        if (isSubscribed) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          console.error('[usePdfLoader] Erro ao carregar PDF:', err);
          setError(err.message || 'Falha ao carregar o arquivo PDF.');
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy();
      }
    };
  }, [urlOrBuffer]);

  return { pdfDoc, numPages, isLoading, error };
}
