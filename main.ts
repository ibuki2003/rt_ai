import OpenAI from "@openai/openai";
import { zodTextFormat } from "@openai/openai/helpers/zod";
import { crayon } from "crayon";
import { load } from "@std/dotenv";
import z from "@zod/zod";
import { readImage, readSource, renderImage } from "./render.ts";
import { SldWorldSchema } from "./sld/types.ts";
import { Stream } from "https://jsr.io/@openai/openai/6.15.0/streaming.ts";
// import { t, createTools } from "zod-to-openai-tool";
import { exit } from "node:process";

const MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `
ツールを使用してレンダリングを行い、くりかえし調整を行って、指定されたテーマに沿った高品質な3D画像を生成してください。
`;

const INITIAL_PROMPT = `
min-rtという非常にシンプルなレイトレーサーを使って、3Dシーンの画像を生成してください。
画像のテーマは「正月の風景」です。

サンプルの作例 \`ball\` も参考にしてください。

`;

const renderToolSchema = z.object({
  name: z.string().describe("シーンの名前"),
  content: SldWorldSchema.describe("シーンの内容"),
});

const readSourceToolSchema = z.object({
  name: z.string().describe("シーンの名前"),
});

const readImageToolSchema = z.object({
  name: z.string().describe("シーンの名前"),
});

const tools: OpenAI.Responses.FunctionTool[] = [
  {
    type: "function",
    name: "render",
    description: "シーンの内容をもとに画像を生成します。",
    parameters: zodTextFormat(renderToolSchema, "render_args").schema,
    strict: true,
  },
  {
    type: "function",
    name: "read_source",
    description: "シーンのソースコードを読み込みます。",
    parameters: zodTextFormat(readSourceToolSchema, "read_source_args").schema,
    strict: true,
  },
  {
    type: "function",
    name: "read_image",
    description: "シーンの画像を読み込みます。",
    parameters: zodTextFormat(readImageToolSchema, "read_image_args").schema,
    strict: true,
  },
];

export const client = new OpenAI({ apiKey: "" });

/// Set the API key for the OpenAI client
/// This function should be called after loading environment variables
export function setApiKey(): void {
  client.apiKey = Deno.env.get("OPENAI_API_KEY") || "";
}

async function main() {
  for (const path of ["./.env"]) {
    try {
      await load({ export: true, envPath: path });
    } catch (error) {
      console.warn(
        `Warning: Failed to load environment variables from ${path}: ${error}`,
      );
    }
  }

  let nextInput: {
    message: string,
    images: string[],
    tool_results: [string, string][];
  } = {
    message: INITIAL_PROMPT,
    images: [],
    tool_results: [],
  };
  let last_id = null;
  let fetch_id = null;

  // check for args
  if (Deno.args.length > 0) {
    console.log(Deno.args);
    fetch_id = Deno.args[0];
  }
  nextInput.message = prompt("Enter your initial input: ") ?? nextInput.message;

  setApiKey();
  client.maxRetries = 5;

  while (true) {
    // agentic loop

    const inputs: OpenAI.Responses.ResponseInput = [];
    for (const [name, result] of nextInput.tool_results) {
      inputs.push({
        type: "function_call_output",
        call_id: name,
        output: result,
      });
    }

    const msginput: OpenAI.Responses.ResponseInputMessageContentList = [
      {
        type: "input_text",
        text: nextInput.message,
      },
    ];

    for (const img of nextInput.images) {
      msginput.push({
        type: "input_image",
        detail: "high",
        // image_url: img,
        image_url: `data:image/png;base64,${img}`,
      })
    }

    inputs.push({
      role: "user",
      content: msginput,
    });

    let response: OpenAI.Responses.Response | null = null;

    if (fetch_id !== null) {
      response = await client.responses.retrieve(fetch_id);
      fetch_id = null;
    } else {
      console.log(crayon.blue("\n=== Sending request to OpenAI ===\n"));
      const res: Stream<OpenAI.Responses.ResponseStreamEvent> = await client.responses.create({
        model: MODEL,
        previous_response_id: last_id,
        instructions: SYSTEM_PROMPT,
        store: true,
        truncation: "auto",

        input: inputs,
        tools,
        parallel_tool_calls: false,
        stream: true,
        reasoning: {
          summary: "detailed",
          effort: "medium",
        },
      });


      for await (const chunk of res) {
        print_delta(chunk);
        switch (chunk.type) {
          case "response.completed": {
            response = chunk.response;
            break;
          }
        }
      }

      if (response === null) {
        console.log("Error!");
        break;
      }
    }

    nextInput = { message: "", images: [], tool_results: [] };

    console.log("ID:", response.id);
    last_id = response.id;
    for (const item of response.output) {
      if (item.type == "reasoning") {
        // console.log(crayon.dim(item.summary));
        // for (const i of item.summary) {
        //   console.log(crayon.dim(i.text));
        // }
      } else if (item.type == "function_call") {
        console.log("calling tool:", item.name);
        switch (item.name) {
          case "render": {
            const args = renderToolSchema.parse(JSON.parse(item.arguments));
            console.log(crayon.green(`Rendering image for "${args.name}"...`));
            try {
              const imageData = await renderImage(args.content, args.name);
              nextInput.tool_results.push([
                item.call_id,
                `画像 "${args.name}" を生成しました。`,
              ]);
              nextInput.images.push(imageData);
            } catch (error) {
              console.error(crayon.red(`Error rendering image "${args.name}": ${error}`));
              nextInput.tool_results.push([
                item.call_id,
                `画像 "${args.name}" の生成に失敗しました: ${error}`,
              ]);
            }
            break;
          }
          case "read_image": {
            const args = readImageToolSchema.parse(JSON.parse(item.arguments));
            console.log(crayon.yellow(`Reading image for "${args.name}"...`));
            try {
              const imageData = await readImage(args.name);
              nextInput.tool_results.push([
                item.call_id,
                `画像 "${args.name}" を読み込みました。`,
              ]);
              nextInput.images.push(imageData);
            } catch (error) {
              console.error(crayon.red(`Error reading image "${args.name}": ${error}`));
              nextInput.tool_results.push([
                item.call_id,
                `画像 "${args.name}" の読み込みに失敗しました: ${error}`,
              ]);
            }
            break;
          }
          case "read_source": {
            const args = readSourceToolSchema.parse(JSON.parse(item.arguments));
            console.log(crayon.yellow(`Reading source for "${args.name}"...`));
            try {
              const sourceData = await readSource(args.name);
              nextInput.tool_results.push([
                item.call_id,
                `ソースコード "${args.name}" の内容:\n${sourceData}\n`,
              ]);
            } catch (error) {
              console.error(crayon.red(`Error reading source "${args.name}": ${error}`));
              nextInput.tool_results.push([
                item.call_id,
                `ソースコード "${args.name}" の読み込みに失敗しました: ${error}`,
              ]);
            }
            break;
          }
        }
      }
    }

    const has_output = response.output.some((item) => item.type === "message");

    if (has_output) {
      // user input required
      while (true) {
        const user_input = prompt("Enter your input: ");
        if (user_input) {
          nextInput.message = user_input;
          break;
        }
      }
    }

    // console.log(crayon.blue("\n=== Next Input Prepared ===\n"));
    // console.log(nextInput);
  }
}

export function print_delta(
  chunk: OpenAI.Responses.ResponseStreamEvent,
) {
  switch (chunk.type) {
    // output text
    case "response.output_text.done": {
      console.log(chunk.text + "\n");
      break;
    }

    // reasoning
    case "response.reasoning_summary_part.done": {
      // console.log(crayon.dim(chunk.part.text + "\n"));
      const lines = chunk.part.text.split('\n');
      for (const line of lines) {
        const l = line.trim();
        // simple markdown (bold)
        if (line.substring(0, 2) == "**" && line.substring(line.length - 2) == "**") {
          console.log(crayon.bold.dim(l.substring(2, l.length - 2)));
        } else {
          console.log(crayon.dim(l));
        }
      }
      console.log("");
      break;
    }
    // case "response.reasoning_summary_text.done": {
    //   console.log(crayon.dim(chunk.text + "\n"));
    //   break;
    // }
  }
}

await main();
