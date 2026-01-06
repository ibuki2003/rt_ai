import { z } from "@zod/zod";

export const Vec3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vec3D = z.infer<typeof Vec3DSchema>;

export const Angle3DSchema = z.object({
  a: z.number(),
  b: z.number(),
});
export type Angle3D = z.infer<typeof Angle3DSchema>;

// export const ColorRGBSchema = z.tuple([z.number(), z.number(), z.number()]);
export const ColorRGBSchema = z.object({
    r: z.number(),
    g: z.number(),
    b: z.number(),
});
export type ColorRGB = z.infer<typeof ColorRGBSchema>;

// enums as strings using z.enum
export const TextureTypeEnum = z.enum([
  "Plain", // 0
  "Checker", // 1
  "Striped", // 2
  "Circular", // 3
  "Dots", // 4
]);
export type TextureType = z.infer<typeof TextureTypeEnum>;

export const ObjectShapeEnum = z.enum([
  "Cube", // 0
  "Plane", // 1
  "Quad", // 2
  "Cone", // 3
]);
export type ObjectShape = z.infer<typeof ObjectShapeEnum>;

export const ReflectTypeEnum = z.enum([
  "Matte", // 0
  "Normal", // 1
  "Mirror", // 2
]);
export type ReflectType = z.infer<typeof ReflectTypeEnum>;

export const LightSchema = z.object({
  angle: Angle3DSchema,
  intensity: z.number(),
});
export type Light = z.infer<typeof LightSchema>;

export const SldObjectSchema = z.object({
  // required
  shape: ObjectShapeEnum,
  param: Vec3DSchema.describe(`
  形によって意味が異なります:
  - 直方体 → X、Y、Z サイズ
  - 無限平面 → 法線ベクトル
  - 二次曲面 → 境界面を与える以下の方程式の A、B、C
      - \`sgn(A)/(A*A)*X^2 + sgn(B)/(B*B)*Y^2 + sgn(C)/(C*C)*Z^2 = 1\`
  `),
  position: Vec3DSchema,
  direction: z.number().describe("CSGの向きを指定します。1を指定するとintersect, -1を指定するとdifference"),
  color: ColorRGBSchema.describe("RGB 各 0 - 255"),

  // optional (everything except shape, param, position, direction, color)
  texture: TextureTypeEnum.optional().nullable(),
  reflect_type: ReflectTypeEnum.optional().nullable(),
  rotation: Vec3DSchema.nullable().optional().nullable().describe("回転角、度単位。回転の向きは試行錯誤して調べてください。"),
  diffuse: z.number().optional().nullable().describe("乱反射率、0 - 1"),
  highlight: z.number().optional().nullable(),
});
export type SldObject = z.infer<typeof SldObjectSchema>;

export const SldOrNetSchema = z.object({
  range_primitive_id: z.number().nullable(),
  connected_and_nets: z.array(z.number()),
});
export type SldOrNet = z.infer<typeof SldOrNetSchema>;

export const SldWorldSchema = z.object({
  camera_position: Vec3DSchema,
  camera_angle: Angle3DSchema.describe("カメラの向き(度)。回転の向きは試行錯誤して調べてください。"),
  lights: z.array(LightSchema).describe("シーン内のライトのリスト。ちょうど1個必要。"),
  objects: z.array(SldObjectSchema).describe("シーン内のオブジェクトのリスト。最大60個まで。"),
  and_nets: z.array(z.array(z.number())).describe("AND ネットのリスト。ANDネットはobjectsの添字(0-index)のリストです。オブジェクトをレンダリングするには、and netのいずれかに属している必要があります。"),
});
export type SldWorld = z.infer<typeof SldWorldSchema>;

