import type { Geometry, RectangleGeometry, CircleGeometry, PolygonGeometry } from '../types/geometry';

export function generateDXF(geometries: Geometry[]): string {
  let dxf = "";
  dxf += "0\nSECTION\n2\nENTITIES\n";
  
  for (const geom of geometries) {
    if (geom.type === 'rectangle') {
      const g = geom as RectangleGeometry;
      const p = [
        { x: g.x, y: g.y },
        { x: g.x + g.width, y: g.y },
        { x: g.x + g.width, y: g.y + g.height },
        { x: g.x, y: g.y + g.height }
      ];
      for(let i = 0; i < p.length; i++) {
        const p1 = p[i];
        const p2 = p[(i + 1) % p.length];
        dxf += "0\nLINE\n8\n0\n";
        dxf += `10\n${p1.x}\n20\n${p1.y}\n30\n0.0\n`;
        dxf += `11\n${p2.x}\n21\n${p2.y}\n31\n0.0\n`;
      }
    } else if (geom.type === 'circle') {
      const g = geom as CircleGeometry;
      dxf += "0\nCIRCLE\n8\n0\n";
      dxf += `10\n${g.cx}\n20\n${g.cy}\n30\n0.0\n`;
      dxf += `40\n${g.radius}\n`;
    } else if (geom.type === 'triangle' || geom.type === 'polygon') {
      const g = geom as PolygonGeometry;
      if (g.points.length >= 3) {
        for(let i = 0; i < g.points.length; i++) {
          const p1 = g.points[i];
          const p2 = g.points[(i + 1) % g.points.length];
          dxf += "0\nLINE\n8\n0\n";
          dxf += `10\n${p1.x}\n20\n${p1.y}\n30\n0.0\n`;
          dxf += `11\n${p2.x}\n21\n${p2.y}\n31\n0.0\n`;
        }
      }
    }
  }
  
  dxf += "0\nENDSEC\n0\nEOF\n";
  return dxf;
}
