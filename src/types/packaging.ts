export interface Annotation {
  id: string;
  pdf_id: string;
  user_id: string;
  content: string;
  x_coord: number; // Porcentagem (0 a 100) relativa à largura
  y_coord: number; // Porcentagem (0 a 100) relativa à altura
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  author_name?: string;
}

export interface MeasurementPoint {
  x: number; // Coordenada X na tela/canvas (pixels renderizados)
  y: number; // Coordenada Y na tela/canvas (pixels renderizados)
}

export interface Measurement {
  id: string;
  start: MeasurementPoint;
  end: MeasurementPoint;
  distanceMm: number;
}

export interface FileItem {
  name: string;
  url: string;
  size: number;
  type?: 'pdf' | 'image';
}

export type ActiveTool = 'select' | 'measure' | 'annotate' | 'diff' | 'cmyk';

export interface CmykChannels {
  cyan: boolean;
  magenta: boolean;
  yellow: boolean;
  black: boolean;
}
