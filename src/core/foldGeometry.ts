export type Point = { x: number; y: number };
export type Corner = "top" | "bottom";
type Matrix = [number, number, number, number, number, number];
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

/** Intersect a rectangle with one side of a crease; independent of rendering. */
export function clipPolygon(points: Point[], normal: Point, offset: number, keepFront: boolean): Point[] {
  const result: Point[] = [];
  const distance = (point: Point) => (dot(normal, point) - offset) * (keepFront ? 1 : -1);
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!, b = points[(index + 1) % points.length]!;
    const da = distance(a), db = distance(b);
    if (da <= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const ratio = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
    }
  }
  return result;
}
function constrain(point: Point, center: Point, radius: number): Point {
  const dx = point.x - center.x, dy = point.y - center.y, length = Math.hypot(dx, dy);
  if (length <= radius) return point;
  return { x: center.x + dx * radius / length, y: center.y + dy * radius / length };
}
export function foldGeometry(width: number, height: number, corner: Corner, pointer: Point) {
  const origin = { x: width, y: corner === "top" ? 0 : height };
  const binding = { x: 0, y: origin.y }, opposite = { x: 0, y: height - origin.y };
  let point = { x: Math.max(-width, Math.min(width - .01, pointer.x)), y: Number.isFinite(pointer.y) ? pointer.y : origin.y };
  point = constrain(point, binding, width);
  point = constrain(point, opposite, Math.hypot(width, height));
  const dx = origin.x - point.x, dy = origin.y - point.y, length = Math.max(.01, Math.hypot(dx, dy));
  const normal = { x: dx / length, y: dy / length };
  const offset = dot(normal, { x: (origin.x + point.x) / 2, y: (origin.y + point.y) / 2 });
  const rectangle = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  const matrix: Matrix = [1 - 2 * normal.x ** 2, -2 * normal.x * normal.y,
    -2 * normal.x * normal.y, 1 - 2 * normal.y ** 2, 2 * offset * normal.x, 2 * offset * normal.y];
  const projections = rectangle.map(vertex => dot(normal, vertex));
  const min = Math.min(...projections), extent = Math.max(.01, Math.max(...projections) - min);
  return { point, normal, offset, matrix, front: clipPolygon(rectangle, normal, offset, true),
    back: clipPolygon(rectangle, normal, offset, false), progress: Math.max(0, Math.min(1, (width - point.x) / (2 * width))),
    shadowAngle: Math.atan2(normal.y, normal.x) * 180 / Math.PI + 90,
    shadowStop: (offset - min) / extent * 100, shadowBand: Math.min(9, 35 / extent * 100) };
}
export function polygonCss(points: Point[]): string {
  if (points.length < 3) return "polygon(0 0, 0 0, 0 0)";
  return `polygon(${points.map(point => `${point.x.toFixed(2)}px ${point.y.toFixed(2)}px`).join(",")})`;
}
export function transformPoint(matrix: Matrix, point: Point): Point {
  return { x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] };
}
