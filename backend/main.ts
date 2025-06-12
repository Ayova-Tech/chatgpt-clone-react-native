// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

console.log("generate-image-azure function called");

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import "jsr:@std/dotenv/load";

import {
  OpenAI,
  APIError,
} from "https://deno.land/x/openai@v4.69.0/mod.ts";

console.log(OpenAI);
if (OpenAI) {
  console.log("OpenAI class is imported and defined.");
} else {
  console.error("OpenAI class is NOT defined after import.");
}

serve(async (req) => {
  try {
    // --- Environment Variable Checks ---
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY_OMC");

    if (!openaiApiKey) {
      console.error("Missing required environment variable OPENAI_API_KEY_OMC");
      const missingVars = [];
      if (!openaiApiKey) missingVars.push("OPENAI_API_KEY_OMC");
      console.error("Missing: " + missingVars.join(", "));
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Missing required environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      console.log("Env variables loaded successfully.");
    }

    // --- Path Routing ---
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method Not Allowed. Please use POST." }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (pathname === "/image-generation") {
      // --- Request Body Validation ---
      const { prompt } = await req.json();
      if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
        return new Response(
          JSON.stringify({
            error: "Prompt is required and must be a non-empty string.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // --- OpenAI Image Generation ---
      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      const imageResponse = await openai.images.generate({
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      console.log(
        "Raw OpenAI imageResponse:",
        JSON.stringify(imageResponse, null, 2)
      );

      if (
        imageResponse.data &&
        imageResponse.data.length > 0 &&
        imageResponse.data[0].url
      ) {
        console.log("Image generated successfully:", imageResponse.data[0].url);
        return new Response(
          JSON.stringify({ imageUrl: imageResponse.data[0].url }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        console.error("No image data received from OpenAI:", imageResponse);
        throw new Error(
          "No image generated from OpenAI or unexpected response structure."
        );
      }
    } else if (pathname === "/chat") {
      // --- Request Body Validation ---
      const { prompt } = await req.json();
      if (!prompt || !Array.isArray(prompt) || prompt.length === 0) {
        return new Response(
          JSON.stringify({ error: "messages must be a non-empty array." }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // --- OpenAI Chat Completion ---
      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      try {
        const chatResponse = await openai.chat.completions.create({
          messages: prompt,
          model: "gpt-3.5-turbo",
        });
        if (
          chatResponse.choices &&
          chatResponse.choices.length > 0 &&
          chatResponse.choices[0].message &&
          chatResponse.choices[0].message.content
        ) {
          return new Response(
            JSON.stringify({ response: chatResponse.choices[0].message.content }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } else {
          return new Response(
            JSON.stringify({ error: "No chat response generated." }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch (chatError) {
        console.error("Error during chat completion:", chatError);
        return new Response(
          JSON.stringify({ error: chatError.message || "Chat error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Not Found. Supported paths: /image-generation, /chat" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.log("Caught APIError details:", {
        status: (error as APIError).status,
        errorObj: (error as APIError).error, // This is the nested error object like { code: "...", message: "..." }
        message: (error as APIError).message,
        name: (error as APIError).name,
        headers: (error as APIError).headers,
      });
    } else if (error instanceof Error) {
      const { message, name } = error;
      console.log("Caught generic Error details:", {
        message: message,
        name: name,
      });
    } else {
      console.log("Caught unknown error:", error);
    }

    console.error("Error in generate-image-azure function:", error); // Keep original full error log

    let errorMessage = "An unexpected error occurred.";
    if (error instanceof APIError) {
      const typedError = error as APIError;
      const nestedError = typedError.error; // error.error is 'unknown'
      if (
        nestedError &&
        typeof nestedError === "object" &&
        "message" in nestedError &&
        typeof (nestedError as any).message === "string"
      ) {
        errorMessage = (nestedError as any).message;
      } else {
        errorMessage = typedError.message; // Fallback to APIError's own message
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    let responseStatus = 500;
    if (error instanceof APIError) {
      responseStatus = (error as APIError).status;
    } else if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof (error as any).status === "number"
    ) {
      const potentialStatus = (error as any).status;
      if (potentialStatus >= 400 && potentialStatus < 600) {
        responseStatus = potentialStatus;
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: responseStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
});
