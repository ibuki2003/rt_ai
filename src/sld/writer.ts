import z from "@zod/zod";
import { ObjectShape, ReflectType, SldObject, SldWorld, TextureType } from "./types.ts";

// Mappings from enum string values to their numeric indices
const textureTypeToIndex: Record<TextureType, number> = {
  Plain: 0,
  Checker: 1,
  Striped: 2,
  Circular: 3,
  Dots: 4,
};

const objectShapeToIndex: Record<ObjectShape, number> = {
  Cube: 1,
  Plane: 2,
  Quad: 3,
  Cone: 4,
};

const reflectTypeToIndex: Record<ReflectType, number> = {
  Matte: 0,
  Normal: 1,
  Mirror: 2,
};

// Defaults for optional fields
const DEFAULT_TEXTURE = "Plain";
const DEFAULT_REFLECT = "Matte";
const DEFAULT_DIFFUSE = 1;
const DEFAULT_HIGHLIGHT = 0.5;

function exportSldObject(o: SldObject): string {
  const ret: number[] = [
    textureTypeToIndex[o.texture ?? DEFAULT_TEXTURE],
    objectShapeToIndex[o.shape],
    reflectTypeToIndex[o.reflect_type ?? DEFAULT_REFLECT],
  ];
  ret.push(o.rotation ? 1 : 0);
  ret.push(o.param.x, o.param.y, o.param.z);
  ret.push(o.position.x, o.position.y, o.position.z);
  ret.push(o.direction, o.diffuse ?? DEFAULT_DIFFUSE, o.highlight ?? DEFAULT_HIGHLIGHT);
  ret.push(o.color.r, o.color.g, o.color.b);
  if (o.rotation) {
    ret.push(o.rotation.x, o.rotation.y, o.rotation.z);
  }
  return ret.join(" ");
}

function exportVec<T>(i: T[], itemexporter: (r: T) => string): string {
  return i.map(itemexporter).join("\n") + "\n-1\n";
}

function exportSldWorld(r: SldWorld): string {
  let ret = "";
  const objectIndexMap: Record<string, number> = {};
  r.objects.forEach(({ name }, idx) => {
    objectIndexMap[name] = idx;
  });

  const d2r = (deg: number) => deg * (Math.PI / 180);
  const direction_vec = {
    x: Math.cos(d2r(r.camera_angle.a)) * Math.sin(d2r(r.camera_angle.b)),
    y: -Math.sin(d2r(r.camera_angle.a)),
    z: Math.cos(d2r(r.camera_angle.a)) * Math.cos(d2r(r.camera_angle.b)),
  };
  const camera_real_position = {
    x: r.camera_position.x + 200 * direction_vec.x,
    y: r.camera_position.y + 200 * direction_vec.y,
    z: r.camera_position.z + 200 * direction_vec.z,
  };


  // env
  // ret += `${r.camera_position.x} ${r.camera_position.y} ${r.camera_position.z} `;
  ret += `${camera_real_position.x} ${camera_real_position.y} ${camera_real_position.z}\n`;
  ret += `${r.camera_angle.a} ${r.camera_angle.b}\n`;
  ret += `${r.lights.length}\n`;

  for (const light of r.lights) {
    ret += `${light.angle.a} ${light.angle.b} ${light.intensity}\n`;
  }

  // items
  ret += exportVec(r.objects, (objectDef) => exportSldObject(objectDef));
  const resolvedAndNets = r.and_nets.map((net, netIdx) => {
    return net.map((objectName) => {
      const objectIndex = objectIndexMap[objectName];
      if (objectIndex === undefined) {
        throw new Error(`ANDネット${netIdx}に存在しないオブジェクト名: ${objectName}`);
      }
      return objectIndex;
    });
  });

  // add objects not in any and_nets as singletons
  const objectsInNets = new Set<number>();
  for (const net of resolvedAndNets) {
    for (const objIdx of net) {
      objectsInNets.add(objIdx);
    }
  }
  r.objects.forEach((_, idx) => {
    if (!objectsInNets.has(idx)) {
      resolvedAndNets.push([idx]);
    }
  });

  ret += exportVec(resolvedAndNets, (net) => net.join(" ") + " -1");
  // for (const ornet of r.or_nets) {
  //   ret += `${ornet.range_primitive_id === null ? 99 : ornet.range_primitive_id} `;
  //   ret += ornet.connected_and_nets.join(" ") + " -1\n";
  // }

  // create dumb or_nets
  ret += `99 `;
  ret += resolvedAndNets.map((_, idx) => idx).join(" ") + " -1\n";

  ret += `-1\n`;


  return ret;
}

export function exportToSld(world: SldWorld): string {
  return exportSldWorld(world);
}
