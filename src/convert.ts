import { renderImage_inner } from "./render.ts";
import { SldWorldSchema } from "./sld/types.ts";
import { exportToSld } from "./sld/writer.ts";

async function main() {
  if (Deno.args.length < 1) {
    console.log("Please provide the input JSON file as an argument.");
    return;
  }

  const source = await Deno.readTextFile(Deno.args[0]);
  const obj = JSON.parse(source);
  const parsed = SldWorldSchema.parse(obj);
  const sldSource = exportToSld(parsed);

  Deno.stdout.write(new TextEncoder().encode(sldSource));

  if (Deno.args.length >= 2) {
    // write image to output file
    const outputFile = Deno.args[1];
    await renderImage_inner(parsed, outputFile);
  }
}

await main();
