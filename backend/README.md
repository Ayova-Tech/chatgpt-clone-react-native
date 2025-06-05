# Backend Server (Deno with Azure OpenAI)

This directory contains the Deno-based backend server responsible for handling API requests for chat completions and image generation, utilizing Azure OpenAI services.

## Features

-   **Chat Endpoint (`/chat`)**: Provides chat completions using Azure OpenAI's text generation models.
-   **Image Generation Endpoint (`/image-generation`)**: Generates images based on user prompts using Azure OpenAI's DALL-E models.

## Technology Stack

-   [Deno](https://deno.land/) as the runtime environment.
-   TypeScript for type safety.
-   Azure OpenAI SDK for Deno (`https://deno.land/x/openai/mod.ts`).

## Prerequisites

-   Deno (version 1.x or later) installed on your system. You can find installation instructions [here](https://deno.land/manual/getting_started/installation).
-   Azure account with access to OpenAI services (for both text and image generation) and the necessary API keys and endpoint details.

## Environment Variables

Create a `.env` file in this `backend` directory with the following environment variables. These are crucial for connecting to your Azure OpenAI resources.

```env
# For Image Generation with Azure OpenAI
AZURE_IMAGE_OPENAI_ENDPOINT="your_azure_image_openai_endpoint_url"
AZURE_IMAGE_OPENAI_API_KEY="your_azure_image_openai_api_key"
AZURE_IMAGE_OPENAI_API_VERSION="your_azure_image_openai_api_version_date"
AZURE_IMAGE_OPENAI_DEPLOYMENT_NAME="your_dall-e_deployment_name"

# For Text/Chat Completion with Azure OpenAI
AZURE_TEXT_OPENAI_ENDPOINT="your_azure_text_openai_endpoint_url"
AZURE_TEXT_OPENAI_API_KEY="your_azure_text_openai_api_key"
AZURE_TEXT_OPENAI_API_VERSION="your_azure_text_openai_api_version_date"
AZURE_TEXT_OPENAI_DEPLOYMENT_NAME="your_gpt_deployment_name"
```

**Note:** The variable names in the `.env` file should match those expected by the Deno server script (e.g., `index.ts`). Please ensure consistency with the `Deno.env.get()` calls in your server code.

## Setup and Running the Server

1.  **Navigate to the backend directory:**
    ```bash
    cd path/to/your/project/backend
    ```

2.  **Ensure your `.env` file is correctly set up** in this directory.

3.  **Run the server (assuming your main file is `index.ts`):**
    ```bash
    deno run --allow-net --allow-env --allow-read index.ts
    ```
    -   `--allow-net`: Allows the server to make network requests (to Azure) and listen for incoming connections.
    -   `--allow-env`: Allows the script to access environment variables (from your `.env` file and system).
    -   `--allow-read`: Allows the script to read files (e.g., the `.env` file if you are using `jsr:@std/dotenv/load`).

The server will typically start on `http://localhost:8000` (or as configured in your Deno script).

## API Endpoints

### 1. Chat Completion

-   **Endpoint:** `/chat`
-   **Method:** `POST`
-   **Request Body (JSON):**
    ```json
    {
      "prompt": [
        { "role": "user", "content": "Hello, how are you?" },
        { "role": "assistant", "content": "I am doing well, thank you!" },
        { "role": "user", "content": "What is Deno?" }
      ]
    }
    ```
    *   `prompt`: An array of message objects representing the conversation history.
-   **Success Response (200 OK):**
    ```json
    {
      "response": "Deno is a secure runtime for JavaScript and TypeScript."
    }
    ```
-   **Error Responses:**
    -   `400 Bad Request`: If the `prompt` is missing or not a non-empty array.
    -   `405 Method Not Allowed`: If a method other than POST is used.
    -   `500 Internal Server Error`: For server-side issues or errors from Azure.

### 2. Image Generation

-   **Endpoint:** `/image-generation`
-   **Method:** `POST`
-   **Request Body (JSON):**
    ```json
    {
      "prompt": "A futuristic cityscape at sunset"
    }
    ```
    *   `prompt`: A string describing the image to be generated.
-   **Success Response (200 OK):**
    ```json
    {
      "imageUrl": "https://your-azure-storage-url/path/to/image.png"
    }
    ```
-   **Error Responses:**
    -   `400 Bad Request`: If the `prompt` is missing or not a non-empty string.
    -   `405 Method Not Allowed`: If a method other than POST is used.
    -   `500 Internal Server Error`: For server-side issues or errors from Azure.

## Troubleshooting

-   **Environment Variables:** Double-check that all environment variables are correctly set in your `.env` file and that the names match exactly what the Deno script expects.
-   **Azure Configuration:** Ensure your Azure OpenAI deployments are active, correctly named, and that your API keys and endpoints are valid.
-   **Deno Permissions:** Make sure you're running the Deno script with the necessary permissions (`--allow-net`, `--allow-env`, `--allow-read`).
-   **Console Logs:** Check the server console output for any error messages or logs that can help diagnose issues.

---

_This README provides a basic guide. You may need to adjust paths, filenames, or specific instructions based on your exact project setup._
