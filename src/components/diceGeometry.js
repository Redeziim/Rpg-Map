import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

const cache = new Map();
export const DICE_SIDES = [4, 6, 8, 10, 12, 20];

export function getDieDefinition(sides) {
  if (cache.has(sides)) return cache.get(sides);
  let geometry;
  if (sides === 4) geometry = new THREE.TetrahedronGeometry(1);
  else if (sides === 6) geometry = new THREE.BoxGeometry(1.35, 1.35, 1.35);
  else if (sides === 8) geometry = new THREE.OctahedronGeometry(1);
  else if (sides === 12) geometry = new THREE.DodecahedronGeometry(1);
  else if (sides === 20) geometry = new THREE.IcosahedronGeometry(1);
  else if (sides === 10) {
    const height = 1.12;
    const offset = height * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
    const points = [new THREE.Vector3(0, height, 0), new THREE.Vector3(0, -height, 0)];
    for (let i = 0; i < 10; i++) points.push(new THREE.Vector3(Math.cos(i * Math.PI / 5), i % 2 ? offset : -offset, Math.sin(i * Math.PI / 5)));
    geometry = new ConvexGeometry(points);
  } else throw new Error(`Dado não suportado: d${sides}`);
  if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
  const position = geometry.getAttribute('position');
  const faces = [];
  for (let i = 0; i < position.count; i += 3) {
    const vertices = [0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(position, i+j));
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
    let face = faces.find(f => f.normal.dot(normal) > .9999);
    if (!face) { face = {normal, vertices: [], value: 0}; faces.push(face); }
    for (const vertex of vertices) if (!face.vertices.some(v => v.distanceTo(vertex) < .0001)) face.vertices.push(vertex);
  }
  let value = 1;
  for (const face of faces) {
    if (face.value) continue;
    face.value = value;
    const opposite = faces.find(f => f !== face && !f.value && f.normal.dot(face.normal) < -.999);
    if (opposite) opposite.value = sides + 1 - value;
    value++;
  }
  for (const face of faces) {
    face.center = face.vertices.reduce((sum,v) => sum.add(v),new THREE.Vector3()).divideScalar(face.vertices.length);
    face.radius = Math.min(...face.vertices.map(v => v.distanceTo(face.center)));
  }
  const definition = { geometry, faces };
  cache.set(sides, definition);
  return definition;
}

// A d4 rests on a face and is read at the opposite, uppermost vertex.
export function readDieFace(sides, quaternion) {
  const { faces } = getDieDefinition(sides);
  const direction = sides === 4 ? -1 : 1;
  return faces.reduce((best, face) => {
    const height = face.normal.clone().applyQuaternion(quaternion).y * direction;
    return !best || height > best.height ? {face, height} : best;
  }, null).face;
}

export function sampleOrientation(random = Math.random) {
  const u = random(), a = 2 * Math.PI * random(), b = 2 * Math.PI * random();
  return new THREE.Quaternion(Math.sqrt(1-u)*Math.sin(a),Math.sqrt(1-u)*Math.cos(a),Math.sqrt(u)*Math.sin(b),Math.sqrt(u)*Math.cos(b));
}

export function settleOrientation(sides, orientation) {
  const face = readDieFace(sides, orientation);
  const normal = face.normal.clone().applyQuaternion(orientation);
  const align = new THREE.Quaternion().setFromUnitVectors(normal,new THREE.Vector3(0,sides===4?-1:1,0));
  return align.multiply(orientation);
}

export function percentileValue(tens, units) {
  return ((tens % 10) * 10 + units % 10) || 100;
}

// Presentation only: face the recorded result toward the viewer, without rerolling.
export function resultPresentationOrientation(sides,value,direction){
  const face=getDieDefinition(sides).faces.find(f=>f.value===value);
  if(!face)throw new Error('Resultado de dado inválido.');
  const toward=direction.clone().normalize();
  const normal=face.normal.clone().multiplyScalar(sides===4?-1:1);
  const rotation=new THREE.Quaternion().setFromUnitVectors(normal,toward);
  if(sides===4)return rotation;
  const labelRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),face.normal);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(labelRotation).applyQuaternion(rotation);
  const desired=new THREE.Vector3(0,1,0).addScaledVector(toward,-toward.y).normalize();
  const angle=Math.atan2(toward.dot(up.clone().cross(desired)),up.dot(desired));
  return new THREE.Quaternion().setFromAxisAngle(toward,angle).multiply(rotation);
}
