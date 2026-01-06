import { crayon } from "crayon";
import { SldWorld } from "./sld/types.ts";
import { exportToSld } from "./sld/writer.ts";

const MINRT = "./minrt_256";

export async function renderImage(input: SldWorld, name: string): Promise<string> {
  // write source to name.json
  await Deno.writeTextFile(`./images/${name}.json`, JSON.stringify(input, null, 2));

  // await Deno.writeFile(`./images/${name}.png`, pngData);
  return await renderImage_inner(input, `./images/${name}.png`);
}

export async function renderImage_inner(input: SldWorld, outfile: string): Promise<string> {

  // simple validation
  if (input.objects.length > 60) {
    throw new Error("Too many objects");
  }
  if (input.lights.length !== 1) {
    throw new Error("Exactly one light is required");
  }

  // convert source to raw source
  const sourceRaw = exportToSld(input);

  console.log(sourceRaw);

  // start subprocess to run minrt
  const process = new Deno.Command(MINRT, {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  {
    const writer = process.stdin?.getWriter();
    writer.write(new TextEncoder().encode(sourceRaw + "\n"));
    writer.close();
    writer.releaseLock();
  }
  const { stdout, stderr, success } = await process.output();
  if (!success) {
    const errorMsg = new TextDecoder().decode(stderr);
    console.log(crayon.red("MinRT Error Output:"));
    console.log(errorMsg);
    throw new Error("MinRT rendering failed: " + errorMsg);
  }

  console.log("MinRT rendering completed");

  // convert ppm to png using magick
  const processMagick = new Deno.Command("magick", {
    args: ["ppm:-", "png:-"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  {
    const writer = processMagick.stdin?.getWriter();
    writer.write(stdout);
    writer.close();
    writer.releaseLock();
  }

  const {
    stdout: pngData,
    stderr: magickStderr,
    success: magickSuccess,
  } = await processMagick.output();

  if (!magickSuccess) {
    const errorMsg = new TextDecoder().decode(magickStderr);
    console.log(crayon.red("Magick Error Output:"));
    console.log(errorMsg);
    throw new Error("Magick conversion failed: " + errorMsg);
  }

  // write png
  await Deno.writeFile(outfile, pngData);

  // return base64 of png
  return pngData.toBase64({ alphabet: "base64" });
}

export async function readImage(name: string): Promise<string> {
  const data = await Deno.readFile(`./images/${name}.png`);
  return data.toBase64({ alphabet: "base64" });
}

export async function readSource(name: string): Promise<string> {
  return await Deno.readTextFile(`./images/${name}.json`);
}
