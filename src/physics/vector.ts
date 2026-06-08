export type Vector3Tuple = [number, number, number];

export function add(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(v: Vector3Tuple, scalar: number): Vector3Tuple {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

export function magnitude(v: Vector3Tuple): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function normalize(v: Vector3Tuple): Vector3Tuple {
  const length = magnitude(v);
  if (length === 0) {
    throw new Error('Cannot normalize a zero-length vector');
  }
  return scale(v, 1 / length);
}

export function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
