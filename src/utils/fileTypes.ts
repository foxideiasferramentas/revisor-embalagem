/**
 * Utilitários para detecção e manipulação de tipos de arquivo (PDF vs Imagens JPG/PNG).
 */

export type DocumentType = 'pdf' | 'image';

export function getDocumentType(fileName: string, mimeType?: string): DocumentType {
  if (mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
  }

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.bmp')
  ) {
    return 'image';
  }

  return 'pdf';
}

/**
 * Carrega um objeto HTMLImageElement de forma assíncrona a partir de uma URL ou Blob.
 */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}
