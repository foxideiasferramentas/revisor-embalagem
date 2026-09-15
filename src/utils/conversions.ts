/**
 * Constantes e utilitários de conversão métrica para arquivos PDF técnicos.
 * 
 * Especificação PDF (ISO 32000-1):
 * - A unidade de medida padrão do PDF é o Ponto Tipográfico (pt).
 * - 1 polegada = 72 pontos.
 * - 1 polegada = 25.4 milímetros.
 * - 1 ponto = 25.4 / 72 mm = ~0.352777778 mm.
 */

export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;
export const MM_PER_POINT = MM_PER_INCH / POINTS_PER_INCH; // ~0.352778

/**
 * Converte distância euclidiana entre dois pontos do canvas para milímetros no documento real.
 * 
 * @param x1 Posição X inicial no viewport (CSS pixels)
 * @param y1 Posição Y inicial no viewport (CSS pixels)
 * @param x2 Posição X final no viewport (CSS pixels)
 * @param y2 Posição Y final no viewport (CSS pixels)
 * @param currentScale Fator de zoom atual aplicado na renderização do PDF.js (ex: 1.0, 1.5, 2.0)
 * @returns Distância calculada em milímetros (mm)
 */
export function calculateDistanceInMm(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  currentScale: number
): number {
  // 1. Distância euclidiana em pixels na tela
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const distanceInCssPixels = Math.hypot(deltaX, deltaY);

  // 2. Converte pixels de tela para pontos nativos do PDF (desfazendo o fator de zoom)
  const distanceInPdfPoints = distanceInCssPixels / currentScale;

  // 3. Converte pontos nativos para milímetros reais
  return distanceInPdfPoints * MM_PER_POINT;
}

/**
 * Formata um valor em milímetros para exibição amigável (mm ou cm).
 */
export function formatMeasurement(mm: number): string {
  if (mm >= 100) {
    return `${(mm / 10).toFixed(2)} cm`;
  }
  return `${mm.toFixed(2)} mm`;
}
