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
}).describe("角度、度単位。aはpitch(-90 - 90)、bはyaw(-180 - 180)に対応します。a=0,b=0でz+方向、aを増やすと下方向、減らすとで上方向。b=90でx+方向、b=-90でx-方向を向きます。");
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
  intensity: z.number().describe("光の強さ 0-255"),
});
export type Light = z.infer<typeof LightSchema>;

export const SldObjectSchema = z.object({
  name: z.string().describe("オブジェクトの名前(ID)"),
  // required
  shape: ObjectShapeEnum,
  param: Vec3DSchema.describe(`
  形によって意味が異なります:
  - Cube: X、Y、Z サイズ
  - Plane: 法線ベクトル
  - Quad: 境界面を与える以下の方程式の A、B、C
    - \`sgn(A)/(A*A)*X^2 + sgn(B)/(B*B)*Y^2 + sgn(C)/(C*C)*Z^2 = 1\`
    - いずれか1つの値を 0 にすると、その軸に沿った無限円柱になります
    - 負の値を与えると、双曲面になります
  - Cone: ちょうど1つの値を負にする必要があります。負の値を与えた軸に沿って尖った円錐面になります。頂点を原点に持ち、2つの合同な円錐面が反対方向に伸びます。
  `),
  position: Vec3DSchema,
  direction: z.number().describe("CSGの向きを指定します。1を指定するとintersect, -1を指定するとdifference"),
  color: ColorRGBSchema.describe("RGB 各 0 - 255"),

  // optional (everything except shape, param, position, direction, color)
  texture: TextureTypeEnum.optional().nullable(),
  reflect_type: ReflectTypeEnum.optional().nullable(),
  rotation: Vec3DSchema.nullable().optional().nullable(),
  diffuse: z.number().optional().nullable().describe("色が反映される割合 0 - 1。鏡面ではないときに1より小さくすると、黒に近づきます。"),
  highlight: z.number().optional().nullable().describe("ハイライトの強さ 0 - 255。reflect_typeがnormalのときのみ有効です。"),
});
export type SldObject = z.infer<typeof SldObjectSchema>;

export const SldOrNetSchema = z.object({
  range_primitive_id: z.number().nullable(),
  connected_and_nets: z.array(z.number()),
});
export type SldOrNet = z.infer<typeof SldOrNetSchema>;

export const SldWorldSchema = z.object({
  camera_position: Vec3DSchema,
  camera_angle: Angle3DSchema,
  lights: z.array(LightSchema).describe("シーン内のライトのリスト。ちょうど1個必要。"),
  objects: z.array(SldObjectSchema).describe("オブジェクト定義の配列。最大60個まで。"),
  and_nets: z.array(z.array(z.string())).describe("AND ネットのリスト。各要素はobjectsで定義されたオブジェクト名のリストです。and netに属していないオブジェクトは単体で、属しているものはCSG計算でそれらの積(または差)が描画されます。オブジェクトは複数のand netに属することもできます。"),
});
export type SldWorld = z.infer<typeof SldWorldSchema>;
