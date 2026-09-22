export type GeometryType = 'rectangle' | 'circle' | 'triangle' | 'polygon';

export interface BaseGeometry {
  id: string;
  type: GeometryType;
}

export interface RectangleGeometry extends BaseGeometry {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleGeometry extends BaseGeometry {
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
}

export interface PolygonGeometry extends BaseGeometry {
  type: 'triangle' | 'polygon';
  points: { x: number; y: number }[];
}

export type Geometry = RectangleGeometry | CircleGeometry | PolygonGeometry;
