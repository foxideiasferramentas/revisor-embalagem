import React, { useState, useEffect, useRef } from 'react';
import { calculateDistanceInMm, formatMeasurement } from '../../utils/conversions';
import type { MeasurementPoint } from '../../types/packaging';

interface MeasurementLayerProps {
  width: number;
  height: number;
  scale: number;
  isActive: boolean;
}

interface ConfirmedMeasurement {
  start: MeasurementPoint;
  end: MeasurementPoint;
  distanceMm: number;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Trava o ponto nos eixos ortogonais (0°, 90°, 180°, 270°) a partir do ponto de partida.
 */
function snapTo90Degrees(
  start: MeasurementPoint,
  current: MeasurementPoint
): { point: MeasurementPoint; orientation: 'horizontal' | 'vertical' } {
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);

  if (dx >= dy) {
    return {
      point: { x: current.x, y: start.y },
      orientation: 'horizontal',
    };
  } else {
    return {
      point: { x: start.x, y: current.y },
      orientation: 'vertical',
    };
  }
}

/**
 * Verifica se o evento de teclado corresponde a uma tecla de alinhamento ortogonal (Alt ou Shift).
 */
function isOrthoTriggerKey(e: KeyboardEvent): boolean {
  return (
    e.key === 'Alt' ||
    e.key === 'AltGraph' ||
    e.code === 'AltLeft' ||
    e.code === 'AltRight' ||
    e.key === 'Shift' ||
    e.code === 'ShiftLeft' ||
    e.code === 'ShiftRight'
  );
}

/**
 * Camada vetorial SVG para medição técnica sobre o documento de embalagem.
 */
export const MeasurementLayer: React.FC<MeasurementLayerProps> = ({
  width,
  height,
  scale,
  isActive,
}) => {
  const [startPoint, setStartPoint] = useState<MeasurementPoint | null>(null);
  const [hoverPoint, setHoverPoint] = useState<MeasurementPoint | null>(null);
  const [confirmedPoints, setConfirmedPoints] = useState<ConfirmedMeasurement | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isOrthoLocked, setIsOrthoLocked] = useState(false);

  // Referências para evitar problemas de closure defasada nos listeners do navegador
  const startPointRef = useRef<MeasurementPoint | null>(null);
  const lastRawPosRef = useRef<MeasurementPoint | null>(null);
  const isAltPressedRef = useRef(false);
  const isOrthoLockedRef = useRef(false);

  // Mantém refs sincronizadas com os estados
  startPointRef.current = startPoint;
  isAltPressedRef.current = isAltPressed;
  isOrthoLockedRef.current = isOrthoLocked;

  // Escuta atalhos de teclado (Alt, Shift para 90° e Esc para cancelar)
  useEffect(() => {
    if (!isActive) {
      setStartPoint(null);
      setHoverPoint(null);
      setIsAltPressed(false);
      isAltPressedRef.current = false;
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tecla Esc: cancela medição em andamento ou limpa cota existente
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setStartPoint(null);
        setHoverPoint(null);
        setConfirmedPoints(null);
        return;
      }

      // Teclas Alt ou Shift: trava em 90 graus
      if (isOrthoTriggerKey(e)) {
        // Previne o menu de atalhos do Windows/navegador para não roubar o foco
        e.preventDefault();
        e.stopPropagation();

        if (!isAltPressedRef.current) {
          isAltPressedRef.current = true;
          setIsAltPressed(true);

          if (startPointRef.current && lastRawPosRef.current) {
            const snapped = snapTo90Degrees(startPointRef.current, lastRawPosRef.current);
            setHoverPoint(snapped.point);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isOrthoTriggerKey(e)) {
        e.preventDefault();
        e.stopPropagation();

        isAltPressedRef.current = false;
        setIsAltPressed(false);

        if (startPointRef.current && lastRawPosRef.current) {
          if (isOrthoLockedRef.current) {
            const snapped = snapTo90Degrees(startPointRef.current, lastRawPosRef.current);
            setHoverPoint(snapped.point);
          } else {
            setHoverPoint(lastRawPosRef.current);
          }
        }
      }
    };

    const handleWindowBlur = () => {
      isAltPressedRef.current = false;
      setIsAltPressed(false);
    };

    // Usando capture para garantir prioridade de interceptação do Alt no Windows
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isActive]);

  if (!isActive) return null;

  const effectiveOrtho = isAltPressed || isOrthoLocked;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Permite apenas botão esquerdo
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Tenta capturar o ponteiro para movimentação fluida
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // Ignora se não for suportado pelo elemento
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const rawPoint: MeasurementPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    lastRawPosRef.current = rawPoint;

    // Atualiza estado de tecla se veio acionada no clique
    const isModifierKeyActive = Boolean(e.altKey || e.shiftKey || isAltPressedRef.current);
    if (isModifierKeyActive !== isAltPressedRef.current) {
      isAltPressedRef.current = isModifierKeyActive;
      setIsAltPressed(isModifierKeyActive);
    }

    const isOrtho = isModifierKeyActive || isOrthoLockedRef.current;
    const currentStart = startPointRef.current;

    if (!currentStart) {
      // Ponto 1 da medição
      setStartPoint(rawPoint);
      setHoverPoint(rawPoint);
      setConfirmedPoints(null);
    } else {
      // Ponto 2 da medição
      let finalPoint = rawPoint;
      let orientation: 'horizontal' | 'vertical' | undefined = undefined;

      if (isOrtho) {
        const snapped = snapTo90Degrees(currentStart, rawPoint);
        finalPoint = snapped.point;
        orientation = snapped.orientation;
      }

      const distance = calculateDistanceInMm(
        currentStart.x,
        currentStart.y,
        finalPoint.x,
        finalPoint.y,
        scale
      );

      setConfirmedPoints({
        start: currentStart,
        end: finalPoint,
        distanceMm: distance,
        orientation,
      });
      setStartPoint(null);
      setHoverPoint(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawPoint: MeasurementPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    lastRawPosRef.current = rawPoint;

    // Sincroniza em tempo real com eventos do mouse
    const isModifierKeyActive = Boolean(e.altKey || e.shiftKey);
    if (isModifierKeyActive !== isAltPressedRef.current) {
      isAltPressedRef.current = isModifierKeyActive;
      setIsAltPressed(isModifierKeyActive);
    }

    const currentStart = startPointRef.current;
    if (!currentStart) return;

    const isOrtho = isModifierKeyActive || isAltPressedRef.current || isOrthoLockedRef.current;
    if (isOrtho) {
      const snapped = snapTo90Degrees(currentStart, rawPoint);
      setHoverPoint(snapped.point);
    } else {
      setHoverPoint(rawPoint);
    }
  };

  const handlePointerEnter = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    lastRawPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const isModifierKeyActive = Boolean(e.altKey || e.shiftKey);
    if (isModifierKeyActive !== isAltPressedRef.current) {
      isAltPressedRef.current = isModifierKeyActive;
      setIsAltPressed(isModifierKeyActive);
    }
  };

  // Determina orientação dinâmica da linha
  let currentOrientation: 'horizontal' | 'vertical' | undefined = undefined;
  if (confirmedPoints) {
    currentOrientation = confirmedPoints.orientation;
  } else if (startPoint && hoverPoint && effectiveOrtho) {
    currentOrientation = snapTo90Degrees(startPoint, hoverPoint).orientation;
  }

  // Linha ativa (traçado temporário ou cota final confirmada)
  const activeLine = confirmedPoints
    ? {
        start: confirmedPoints.start,
        end: confirmedPoints.end,
        distanceMm: confirmedPoints.distanceMm,
        isConfirmed: true,
        orientation: confirmedPoints.orientation,
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
        orientation: currentOrientation,
      }
    : null;

  const midX = activeLine ? (activeLine.start.x + activeLine.end.x) / 2 : 0;
  const midY = activeLine ? (activeLine.start.y + activeLine.end.y) / 2 : 0;

  // Dimensão da etiqueta flutuante
  const hasOrientationLabel = Boolean(activeLine?.orientation);
  const badgeWidth = hasOrientationLabel ? 128 : 96;
  const badgeHeight = 26;

  return (
    <svg
      style={{ width, height }}
      className="absolute inset-0 z-20 cursor-crosshair select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
    >
      <defs>
        {/* Marcador de seta para a cota livre */}
        <marker
          id="arrow-start"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#2563eb" />
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
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#2563eb" />
        </marker>

        {/* Marcador de seta para a cota em 90° */}
        <marker
          id="arrow-start-ortho"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#4f46e5" />
        </marker>
        <marker
          id="arrow-end-ortho"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 0 2 L 8 5 L 0 8 z" fill="#4f46e5" />
        </marker>
      </defs>

      {/* Linhas guias inteligentes ortogonais quando a trava de 90° estiver ativa */}
      {effectiveOrtho && startPoint && (
        <g className="pointer-events-none opacity-40">
          {currentOrientation === 'horizontal' ? (
            <line
              x1={0}
              y1={startPoint.y}
              x2={width}
              y2={startPoint.y}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          ) : (
            <line
              x1={startPoint.x}
              y1={0}
              x2={startPoint.x}
              y2={height}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}
        </g>
      )}

      {/* HUD Superior Informativo com atalhos e botão de trava direta */}
      <g
        transform={`translate(${Math.max(16, width / 2 - 200)}, 16)`}
        className="transition-all duration-200"
      >
        <rect
          x="0"
          y="0"
          width="400"
          height="34"
          rx="17"
          fill={effectiveOrtho ? '#312e81' : '#0f172a'}
          fillOpacity={effectiveOrtho ? 0.95 : 0.88}
          stroke={effectiveOrtho ? '#818cf8' : '#334155'}
          strokeWidth={effectiveOrtho ? 1.8 : 1}
          className="filter drop-shadow-lg pointer-events-none"
        />

        {/* Texto informativo com atalhos */}
        <text
          x="150"
          y="21"
          textAnchor="middle"
          fill="#f8fafc"
          fontSize="11"
          fontWeight="600"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          className="pointer-events-none select-none"
        >
          {effectiveOrtho
            ? '🔒 Trava 90° Ativa • [Esc] Cancelar'
            : startPoint
            ? '📏 Ponto 2: Segure [Alt] p/ 90° • [Esc] Cancelar'
            : '📏 Medição: Segure [Alt] p/ 90° • [Esc] Limpar'}
        </text>

        {/* Botão interativo para ativar/desativar modo 90° com 1 clique */}
        <g
          className="cursor-pointer pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            setIsOrthoLocked((prev) => !prev);
          }}
        >
          <rect
            x="300"
            y="5"
            width="90"
            height="24"
            rx="12"
            fill={isOrthoLocked ? '#4f46e5' : '#1e293b'}
            stroke={isOrthoLocked ? '#c7d2fe' : '#475569'}
            strokeWidth="1"
          />
          <text
            x="345"
            y="21"
            textAnchor="middle"
            fill={isOrthoLocked ? '#ffffff' : '#94a3b8'}
            fontSize="10"
            fontWeight="700"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {isOrthoLocked ? '🔒 90° ATIVO' : '🔓 90° OFF'}
          </text>
        </g>
      </g>

      {activeLine && (
        <g className="transition-all duration-75">
          {/* Linha de contraste inferior para legibilidade em fundos claros ou escuros */}
          <line
            x1={activeLine.start.x}
            y1={activeLine.start.y}
            x2={activeLine.end.x}
            y2={activeLine.end.y}
            stroke="white"
            strokeWidth={effectiveOrtho ? '4.5' : '3.5'}
            strokeLinecap="round"
          />

          {/* Linha de medição principal */}
          <line
            x1={activeLine.start.x}
            y1={activeLine.start.y}
            x2={activeLine.end.x}
            y2={activeLine.end.y}
            stroke={activeLine.orientation || effectiveOrtho ? '#4f46e5' : '#2563eb'}
            strokeWidth={activeLine.orientation || effectiveOrtho ? '2.5' : '2'}
            strokeDasharray={activeLine.isConfirmed ? 'none' : '4 3'}
            markerStart={activeLine.orientation || effectiveOrtho ? 'url(#arrow-start-ortho)' : 'url(#arrow-start)'}
            markerEnd={activeLine.orientation || effectiveOrtho ? 'url(#arrow-end-ortho)' : 'url(#arrow-end)'}
          />

          {/* Âncoras nos extremos */}
          <circle
            cx={activeLine.start.x}
            cy={activeLine.start.y}
            r={activeLine.orientation || effectiveOrtho ? 5 : 4}
            fill={activeLine.orientation || effectiveOrtho ? '#4f46e5' : '#2563eb'}
            stroke="white"
            strokeWidth="1.5"
          />
          <circle
            cx={activeLine.end.x}
            cy={activeLine.end.y}
            r={activeLine.orientation || effectiveOrtho ? 5 : 4}
            fill={activeLine.orientation || effectiveOrtho ? '#4f46e5' : '#2563eb'}
            stroke="white"
            strokeWidth="1.5"
          />

          {/* Etiqueta flutuante com a distância em milímetros */}
          <g transform={`translate(${midX}, ${midY - 14})`}>
            <rect
              x={-badgeWidth / 2}
              y={-badgeHeight / 2}
              width={badgeWidth}
              height={badgeHeight}
              rx="8"
              fill="#ffffff"
              stroke={activeLine.orientation || effectiveOrtho ? '#4f46e5' : '#2563eb'}
              strokeWidth="1.8"
              className="filter drop-shadow-sm"
            />
            <text
              x="0"
              y="2"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={activeLine.orientation || effectiveOrtho ? '#312e81' : '#1e1b4b'}
              fontSize="11"
              fontWeight="700"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {formatMeasurement(activeLine.distanceMm)}
              {activeLine.orientation ? ` (${activeLine.orientation === 'horizontal' ? '90° H' : '90° V'})` : ''}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
};
