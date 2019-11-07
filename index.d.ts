type THREE = {
  PlaneBufferGeometry: any;
  REVISION: string;
};

declare namespace THREE {
  export type Color = any;

  export type Camera = any;

  export type ImageTexture = any;

  export type MaterialOptions = any;

  export type Material = any;

  export type Matrix4 = any;

  export type MeshBasicMaterial = any;

  export type RingGeometry = any;

  export type Scene = any;

  export type Shape = any;

  export type Sprite = any;

  export type Texture = any;

  export type Vector2 = any;
  export type Vector3 = any;

  export type Object3D = {
    position: Vector3;
    scale: Vector3;
    children: Object3D[];
    userData: any;
    visible?: boolean;
    material: Material;

    add(obj: Object3D): void;
  };

  export type Uniforms = any;
}

declare const THREE;

export = THREE;
