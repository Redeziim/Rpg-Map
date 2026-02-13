import type { Object3DNode } from "@react-three/fiber";
import type { Object3D } from "three";

declare module "@react-three/fiber" {
  interface ThreeElements {
    primitive: Object3DNode<Object3D, typeof Object3D> & {
      object: Object3D;
    };
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: Object3DNode<Object3D, typeof Object3D> & {
        object: Object3D;
      };
    }
  }
}
