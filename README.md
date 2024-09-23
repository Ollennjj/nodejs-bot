Got it! Here's the updated README with your new API endpoint for ingesting posts:

# Jeff Bot

Jeff Bot is a project that provides chatbot functionalities using OpenAI's GPT-3.5 Turbo model and integrates with Pinecone for document indexing and searching.

## Installation

1. Clone the repository:

    ```bash
    git clone <clone-URL>
    ```

2. Install dependencies:

    ```bash
    cd jeff-bot
    yarn install
    ```

3. Set up environment variables:

    Create a `.env` file in the root of your project with the following content:

    ```dotenv
    OPENAI_API_KEY=your_openai_api_key
    PINECONE_API_KEY=your_pinecone_api_key
    PINECONE_ENVIRONMENT=your_pinecone_environment
    ```

4. Start the server:

    ```bash
    yarn start
    ```

## Usage

### Chat Completion

Send a POST request to `/api/open-ai/chat-completion` with the following body:

```json
{
    "prompt": "Your chat prompt here."
}
```

This will return a completion of the chat prompt using OpenAI's GPT-3.5 Turbo model.

### Creating Pinecone Index

Send a POST request to `/api/create-index` to create a new Pinecone index.

## Ingesting Posts

To ingest posts into the Pinecone index, follow these steps:

1. **Send a POST Request**: Send a POST request to the `/api/ingest-posts` endpoint of your application.

2. **Provide Post Data**:

    - Include the post you want to ingest in the request body.
    - Ensure the request body includes the keys `post` for the post content and `LastPineconeIngestedVectorIdIndex` for the last ingested vector ID index.

3. **Example Request**:

    ```http
    POST /api/ingest-posts HTTP/1.1
    Content-Type: application/json

    {
      "post": "Your post content here.",
      "LastPineconeIngestedVectorIdIndex": 0
    }
    ```

## Ingesting Blogs

To ingest blogs into the Pinecone index, follow these steps:

1. **Send a BLOG Request**: Send a BlOG request to the `/api/ingest-blogs` endpoint of your application.

2. **Provide Blog Data**:

    - Include the blog you want to ingest in the request body.
    - Ensure the request body includes the keys `blog` for the blog content and `LastPineconeIngestedVectorIdIndex` for the last ingested vector ID index.

3. **Example Request**:

    ```http
    POST /api/ingest-blogs HTTP/1.1
    Content-Type: application/json

    {
      "blog": "Your blog content here.",
      "LastPineconeIngestedVectorIdIndex": 0
    }
    ```

## Ingesting Documents

To ingest documents into the Pinecone index, follow these steps:

1. **Send a POST Request**: Send a POST request to the `/api/ingest-documents` endpoint of your application.

2. **Provide Form Data**:
   - Include the documents you want to ingest as files in the form data.
   - Ensure the form data includes the key `files` with the value being the uploaded file(s).

3. **Last Ingested Vector ID Index**:
   - Include the index of the last ingested vector ID in the Pinecone index.
   - This helps track the ingestion progress and avoid duplicate ingestions.

4. **Example Request**:
   ```http
   POST /api/ingest-documents HTTP/1.1
   Content-Type: multipart/form-data

   files: <file1>, <file2>
   LastPineconeIngestedVectorIdIndex: 0


### Chat Query

Send a POST request to `/api/chat` with the following body:

```json
{
    "question": "Your question here."
}
```

This will query the Pinecone index for relevant documents based on the question.

## License

ISC License

Add your actual API keys and environment variables to the `.env` file.
