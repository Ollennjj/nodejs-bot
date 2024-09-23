import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAI } from 'langchain/llms/openai';
import { loadQAStuffChain } from 'langchain/chains';
import { Document } from 'langchain/document';
import { blogDataKey, postDataKey, timeout } from '../config';
import { Pinecone } from '@pinecone-database/pinecone';

const promptFetchDuration = 1; // 1000 * 60 * 60 * (1 / 4);
let lastPromptFetchTime = 0;
let lastPrompt = '';

const fetchPrompt = async () => {
  try {
    if (
      !lastPrompt ||
      !lastPromptFetchTime ||
      Date.now() - lastPromptFetchTime > promptFetchDuration
    ) {
      const prompt = await new Promise<string>((resolve, reject) => {
        fetch('https://personalchemy.io/wp-json/custom/v1/get-prompt', {
          method: 'GET',
        })
          .then((response) => response.json())
          .then((data: any) => {
            resolve(data.prompt);
            lastPrompt = data.prompt;
            lastPromptFetchTime = Date.now();
          })
          .catch((error) => {
            reject(error);
          });
      });
      console.log('Fetched');
      return prompt;
    } else {
      console.log('Not Fetched', { lastPrompt });
    }
  } catch (error) {
    console.log('Error fetching prompt', error);
  }
  return lastPrompt;
};

export const queryPineconeVectorStoreAndQueryLLM = async (
  client: Pinecone,
  indexName: string,
  question: string,
  userName: string,
  userId: string,
  chatHistory: string[],
) => {
  console.log('Querying Pinecone vector store...', {
    indexName,
    userName,
    userId,
    question,
    chatHistory,
  });

  const index = client.Index(indexName);

  let updateQuestion = question;
  
  updateQuestion = updateQuestion.replace(/\b(?:I|my|mine|me|myself)\b/gi, userName.toLowerCase());

  const queryEmbedding = await new OpenAIEmbeddings().embedQuery(updateQuestion);
  let queryResponse = await index.query({
    topK: 10,
    vector: queryEmbedding,
    includeMetadata: true,
    includeValues: true,
    filter: {
      $or: [
        { userId: { $eq: userId } },
        { dataKey: { $in: [blogDataKey, postDataKey] } },
      ],
    },
  });
  console.log(`Found ${queryResponse?.matches?.length || 0} matches...`);

  // Extract and concatenate page content from matched documents
  const concatenatedPageContent =
    queryResponse?.matches
      ?.map((match: any) => match.metadata.pageContent)
      .join(' ') || '';

  const generatePrompt = async (
    _chatHistory: string[],
    _question: string,
    _userName: string,
  ) => {
    const staticPrompt = `* User name: "${_userName}"
* User query: "this is${question}"
* Conversation history: \n\`\`\`${_chatHistory.join('\n')}\`\`\`

Your role:
Your name is Stoa, and you are a wise, personal personality trainer and stoic muse. who talks philosophically.
Your responses must consider the user's personality type and other traits outlined in the "${_userName}" variable to provide personalized answers to the user's questions.
You must craft each response from the lens of the user's unique personality type while maintaining a philosophical (stoic) tone, providing insight and guidance in a concise, practical, and non-preachy way.

Behavior:
Before responding, analyze what specific information from the personality profile is most important for giving a well-informed answer.
Ask the user for clarification when necessary to fully understand their question or context.
Provide a detailed response based on the user's profile without pulling in any other user's data.

Tone:
Stick to Stoic principles, emphasizing logic, control, self-discipline, and calmness. Avoid being overly formal or preachy, keeping responses compact and focused.
Exclude phrases such as "based on the information provided" or "Ah, ${_userName}".`;
    try {
      const prompt = await fetchPrompt();

      let newPrompt = prompt || staticPrompt;

      while (newPrompt.includes('\r\n')) {
        newPrompt = newPrompt.replace('\r\n', '\n');
      }
      while (newPrompt.includes('\n\n')) {
        newPrompt = newPrompt.replace('\n\n', '\n');
      }
      while (newPrompt.includes('\\n')) {
        newPrompt = newPrompt.replace('\\n', '\n');
      }
      while (newPrompt.includes('{{chat_history}}')) {
        newPrompt = newPrompt.replace(
          '{{chat_history}}',
          _chatHistory.join('\n'),
        );
      }
      while (newPrompt.includes('{{user_name}}')) {
        newPrompt = newPrompt.replace('{{user_name}}', _userName);
      }
      while (newPrompt.includes('{{question}}')) {
        newPrompt = newPrompt.replace('{{question}}', _question);
      }
      newPrompt = newPrompt.replace(/\b(?:I|my|mine|me|myself)\b/gi, _userName.toLowerCase());
      return newPrompt;
    } catch (error) {
      console.log('Error fetching prompt', error);
    }
    return staticPrompt;
  };

  let identityAndPurposePrompt = '';

  const maxContextTokens = 16385 * 0.2;

  do {
    // If the identityAndPurposePrompt words exceeds 75% of the max context tokens, reduce the context
    if (identityAndPurposePrompt) {
      chatHistory.unshift();
      chatHistory.unshift();
    }

    // Add identity, purpose, and agentic framework prompt
    identityAndPurposePrompt = await generatePrompt(
      chatHistory,
      question,
      userName,
    );
  } while (
    identityAndPurposePrompt.split(' ').length > maxContextTokens * 0.75 &&
    chatHistory.length > 1
  );

  // Create an OpenAI instance and load the QAStuffChain
  const llm = new OpenAI({
    modelName: 'gpt-4o-mini', // Defaults to "gpt-3.5-turbo-instruct" if no model provided.
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  const chain = loadQAStuffChain(llm);

  // Execute the chain with input documents, question, and identity prompt
  const result = await chain.call({
    input_documents: [new Document({ pageContent: concatenatedPageContent })],
    question: identityAndPurposePrompt,
  });

  // Agentic Framework with Clarification Questions
  if (
    result.text === "I don't know." ||
    result.text.includes('I need more information')
  ) {
    console.log('Since there are no matches, GPT-3 will not be queried.');
    // Potentially ask a clarifying question here
    return 'Hmm, I am not sure I understand your question. Can you rephrase or provide more context?';
  }

  // Log the answer
  console.log(`Answer: ${result.text}`);
  return result.text;
};

export const createPineconeIndex = async (
  client: Pinecone,
  indexName: string,
  vectorDimension: number,
) => {
  console.log(`Creating "${indexName}"...`);
  await client.createIndex({
    name: indexName,
    dimension: vectorDimension,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: process.env.PINECONE_ENVIRONMENT || '',
      },
    },
  });
  console.log(`Creating index.... please wait for it to finish initializing.`);
  await new Promise((resolve) => setTimeout(resolve, timeout));
};

export const updatePineconeWithDocs = async (
  client: Pinecone,
  indexName: string,
  docs: any,
  userId: string,
) => {
  try {
    let text = '';
    for (const doc of docs) {
      console.log(`Processing document: ${doc.metadata.source}`);
      console.log('per page length', doc.pageContent.length);
      text = `${text}${doc.pageContent.replace(/\n/g, ' ')}`;
    }
    await updatePineconeWithText({ client, indexName, text, userId });
  } catch (error) {
    throw error;
  }
};

export const updatePineconeWithText = async ({
  client,
  indexName,
  text,
  userId,
  dataKey,
  uniqueId,
}: {
  client: Pinecone;
  indexName: string;
  text: string;
  userId?: string;
  dataKey?: string;
  uniqueId?: string;
}) => {
  try {
    console.log('Retrieving Pinecone index...');
    const index = client.Index(indexName);
    console.log(`Pinecone index retrieved: ${indexName}`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
    });

    console.log('Splitting text into chunks...');
    const chunks = await textSplitter.createDocuments([text]);
    console.log(`Text split into ${chunks.length} chunks`);

    console.log(
      `Calling OpenAI's Embedding endpoint documents with ${chunks.length} text chunks ...`,
    );
    const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
      chunks.map((chunk) => chunk.pageContent.replace(/\n/g, ' ')),
    );
    console.log('Finished embedding documents', embeddingsArrays.length);

    console.log(
      `Creating ${chunks.length} vectors array with id, values, and metadata...`,
    );

    // Create and upsert vectors in batches of 100
    const batchSize = 100;
    let batch: {
      id: string;
      values: number[];
      metadata: {
        pageContent: string;
        userId?: string;
        dataKey?: string;
        uniqueId?: string;
      };
    }[] = [];

    for (let i = 0; i < embeddingsArrays.length; i++) {
      const chunk = chunks[i];
      const vector = {
        id: `${uniqueId ?? ''}${dataKey ?? ''}${userId ?? ''}_${i}`,
        values: embeddingsArrays[i],
        metadata: {
          pageContent: chunk.pageContent,
          userId,
          dataKey,
          uniqueId,
        },
      };
      batch = [...batch, vector];

      // When batch is full or it's the last item, upsert the vectors
      if (batch.length === batchSize || i === embeddingsArrays.length - 1) {
        await index.upsert(batch);
        // Empty the batch
        batch = [];
      }
    }

    console.log('Vectors Upsert');
  } catch (error) {
    throw error;
  }
};
