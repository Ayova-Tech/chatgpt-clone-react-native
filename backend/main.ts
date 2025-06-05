// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment

console.log("generate-image-azure function called");

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import "jsr:@std/dotenv/load";

import {
  AzureOpenAI,
  APIError,
} from "https://deno.land/x/openai@v4.69.0/mod.ts";

console.log(AzureOpenAI);
if (AzureOpenAI) {
  console.log("AzureOpenAI class is imported and defined.");
} else {
  console.error("AzureOpenAI class is NOT defined after import.");
}

serve(async (req) => {
  try {
    // --- Environment Variable Checks ---
    //IMAGE
    const image_azureOpenaiEndpoint = Deno.env.get("AZURE_IMAGE_OPENAI_ENDPOINT");
    const image_azureOpenaiApiKey = Deno.env.get("AZURE_IMAGE_OPENAI_API_KEY");
    const image_apiVersion = Deno.env.get("AZURE_IMAGE_OPENAI_API_VERSION");
    const image_deploymentNameEnv = Deno.env.get("AZURE_IMAGE_OPENAI_DEPLOYMENT_NAME");


    //TEXT
    const text_azureOpenaiEndpoint = Deno.env.get("AZURE_TEXT_OPENAI_API_KEY");
    const text_azureOpenaiApiKey = Deno.env.get("AZURE_TEXT_OPENAI_API_VERSION");
    const text_apiVersion = Deno.env.get("AZURE_TEXT_OPENAI_GENERATOR_ENDPOINT");
    const text_deploymentNameEnv = Deno.env.get("AZURE_TEXT_OPENAI_GENERATOR_DEPLOYMENT");

    if (
      !image_azureOpenaiEndpoint ||
      !image_azureOpenaiApiKey ||
      !image_apiVersion ||
      !image_deploymentNameEnv ||
      !text_azureOpenaiEndpoint ||
      !text_azureOpenaiApiKey ||
      !text_apiVersion ||
      !text_deploymentNameEnv
    ) {
      console.error(
        "Missing one or more required environment variables for Azure OpenAI or Supabase."
      );
      const missingVars = [];
      if (!image_azureOpenaiEndpoint) missingVars.push("AZURE_IMAGE_OPENAI_ENDPOINT");
      if (!image_azureOpenaiApiKey) missingVars.push("AZURE_IMAGE_OPENAI_API_KEY");
      if (!image_apiVersion) missingVars.push("AZURE_IMAGE_OPENAI_API_VERSION");
      if (!image_deploymentNameEnv) missingVars.push("AZURE_IMAGE_OPENAI_DEPLOYMENT_NAME");
      if (!text_azureOpenaiEndpoint) missingVars.push("AZURE_TEXT_OPENAI_API_KEY");
      if (!text_azureOpenaiApiKey) missingVars.push("AZURE_TEXT_OPENAI_API_VERSION");
      if (!text_apiVersion) missingVars.push("AZURE_TEXT_OPENAI_GENERATOR_ENDPOINT");
      if (!text_deploymentNameEnv) missingVars.push("AZURE_TEXT_OPENAI_GENERATOR_DEPLOYMENT");
      console.error("Missing: " + missingVars.join(", "));
      return new Response(
        JSON.stringify({
          error:
            "Server configuration error: Missing required environment variables.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      console.log("Env variables loaded successfully.");
    }

    // // --- Authentication ---
    // const authHeader = req.headers.get("Authorization");
    // if (!authHeader) {
    //   return new Response(
    //     JSON.stringify({ error: "Authorization header missing." }),
    //     {
    //       status: 401,
    //       headers: { "Content-Type": "application/json" },
    //     }
    //   );
    // }

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

      // --- Azure OpenAI Image Generation ---
      console.log(
        `Initializing AzureOpenAI client. Endpoint: ${image_azureOpenaiEndpoint}, API Version: ${image_apiVersion}, Deployment: ${image_deploymentNameEnv}`
      );

      console.log("Azure OpenAI Client Config:", {
        endpoint: image_azureOpenaiEndpoint,
        apiKeyIsSet: !!image_azureOpenaiApiKey,
        apiVersion: image_apiVersion,
        deployment: image_deploymentNameEnv,
      });
      const azureClient = new AzureOpenAI({
        endpoint: image_azureOpenaiEndpoint,
        apiKey: image_azureOpenaiApiKey,
        apiVersion: image_apiVersion,
        deployment: image_deploymentNameEnv, // The deployment name is passed to the client constructor
      });

      console.log(
        `Generating image for prompt: "${prompt}" using Azure deployment: ${image_deploymentNameEnv}`
      );

      const imageResponse = await azureClient.images.generate({
        prompt: prompt,
        model: "", // For Azure DALL-E 3, deployment name in client config specifies the model
        n: 1,
        size: "1024x1024",
        style: "vivid", // or "natural"
      });

      console.log(
        "Raw Azure imageResponse:",
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
        console.error("No image data received from Azure OpenAI:", imageResponse);
        throw new Error(
          "No image generated from Azure or unexpected response structure."
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

      // --- Azure OpenAI Chat Completion ---
      console.log(
        `Initializing AzureOpenAI client for chat. Endpoint: ${text_azureOpenaiEndpoint}, API Version: ${text_apiVersion}, Deployment: ${text_deploymentNameEnv}`
      );

      const azureClient = new AzureOpenAI({
        endpoint: text_apiVersion, // this is actually the endpoint for chat
        apiKey: text_azureOpenaiEndpoint, // this is actually the API key for chat
        apiVersion: text_azureOpenaiApiKey, // this is actually the API version for chat
        deployment: text_deploymentNameEnv,
      });

      try {
        const chatResponse = await azureClient.chat.completions.create({
          messages: prompt,
          model: "", // Model is specified by deployment
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
