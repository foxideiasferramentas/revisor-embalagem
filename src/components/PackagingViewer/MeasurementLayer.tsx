import React, { useState } from 'react';
import { calculateDistanceInMm, formatMeasurement } from '../../utils/conversions';
import type { MeasurementPoint } from '../../types/packaging';

interface MeasurementLayerProps {
  width: number;
  height: number;
  scale: number;
  isActive: boolean;
}

/**
 * Camada vetorial SVG para medição técnica sobre o documento de embalagem.
 * 
 * Mecânica de Interação:
 * 1. Primeiro clique: define o ponto de ancoragem inicial (P1).
 * 2. Movimento do mouse: desenha linha guia dinâmica em tempo real.
 * 3. Segundo clique: fixa a cota de medição no documento.
 */
export const MeasurementLayer: React.FC<MeasurementLayerProps> = ({
  width,
  height,
  scale,
  isActive,
}) => {
  const [startPoint, setStartPoint] = useState<MeasurementPoint | null>(null);
  const [hoverPoint, setHoverPoint] = useState<MeasurementPoint | null>(null);
  const [confirmedPoints, setConfirmedPoints] = useState<{
    start: MeasurementPoint;
    end: MeasurementPoint;
    distanceMm: number;
  } | null>(null);

  if (!isActive) return null;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const currentPoint: MeasurementPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (!startPoint) {
      // Inicia medição
      setStartPoint(currentPoint);
      setHoverPoint(currentPoint);
      setConfirmedPoints(null);
    } else {
      // Conclui medição
      const distance = calculateDistanceInMm(
        startPoint.x,
        startPoint.y,
        currentPoint.x,
        currentPoint.y,
        scale
      );
      setConfirmedPoints({
        start: startPoint,
        end: currentPoint,
        distanceMm: distance,
      });
      setStartPoint(null);
      setHoverPoint(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPoint({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Linha ativa (ou a temporária durante o traçado ou a final confirmada)
  const activeLine = confirmedPoints
    ? {
        start: confirmedPoints.start,
        end: confirmedPoints.end,
        distanceMm: confirmedPoints.distanceMm,
        isConfirmed: true,
      }
    : startPoint && hoverPoint
    ? {
        start: startPoint,
        end: hoverPoint,
        distanceMm: calculateDistanceInMm(
          startPoint.x,
          startPoint.y,
          hoverPoint.x,
          hoverPoint.y,
          scale
        ),
        isConfirmed: false,
      }
    : null;

  const midX = activeLine ? (activeLine.start.x + activeLine.end.x) / 2 : 0;
  const midY = activeLine ? (activeLine.start.y + activeLine.end.y) / 2 : 0;

  return (
    <svg
      style={{ width, height }}
      className="absolute inset-0 z-20 cursor-crosshair select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      <defs>
        {/* Marcador de seta para a cota */}
        <marker
          id="arrow-start"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#3b82f6" />
        </marker>
        <marker
          id="arrow-end"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#3b82f6" />
        </marker>
      </defs>

      {activeLine && (
        <g className="transition-all duration-75">
          {/* Linha de sombra/contraste para fundos claros ou escuros */}
          <line
            x1={activeLine.start.x}
            y1={activeLine.start.y}
            x2={activeLine.end.x}
            y2={activeLine.end.y}
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Linha de medição principal */}
          <line
            x1={activeLine.start.x}
            y1={activeLine.start.y}
            x2={activeLine.end.x}
            y2={activeLine.end.y}
            stroke="#2563eb"
            strokeWidth="2"
            strokeDasharray={activeLine.isConfirmed ? 'none' : '4 3'}
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />

          {/* Âncoras circulares dos pontos extremos */}
          <circle cx={activeLine.start.x} cy={activeLine.start.y} r="4" fill="#2563eb" stroke="white" strokeWidth="1.5" />
          <circle cx={activeLine.end.x} cy={activeLine.end.y} r="4" fill="#2563eb" stroke="white" strokeWidth="1.5" />

          {/* Etiqueta flutuante com a distância em milímetros */}
          <g transform={`translate(${midX}, ${midY - 14})`}>
            <rect
              x="-48"
              y="-14"
              width="96"
              height="26"
              rx="8"
              fill="#ffffff"
              stroke="#4f46e5"
              strokeWidth="1.8"
              className="filter drop-shadow-sm"
            />
            <text
              x="0"
              y="2"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#1e1b4b"
              fontSize="11"
              fontWeight="700"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {formatMeasurement(activeLine.distanceMm)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};
