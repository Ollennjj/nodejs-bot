import express from 'express';
import multer from 'multer';
import session from 'express-session';
import { Pinecone } from '@pinecone-database/pinecone';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import {
  createPineconeIndex,
  queryPineconeVectorStoreAndQueryLLM,
  updatePineconeWithDocs,
  updatePineconeWithText,
} from './services/pinconeHandlers';
import { blogDataKey, indexName, postDataKey } from './config';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { summarizeBlog, summarizePost } from './services/sumarize';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors'; // Import the cors middleware

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors()); // Use the cors middleware to enable CORS

app.use(
  session({
    secret: 'stoa-sk-139%32#',
    saveUninitialized: true,
    resave: true,
  }),
);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/api/open-ai/chat-completion', async (req, res) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  const { prompt } = req.body;

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    res.setHeader('Content-Type', 'text/plain');

    // Write each chunk of the response to the response stream
    for await (const chunk of stream) {
      res.write(chunk.choices[0]?.delta?.content || '');
    }

    res.end();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/create-index', async (req, res) => {
  console.log(process.env.PINECONE_API_KEY);
  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  });

  const vectorDimensions = 1536;
  try {
    await createPineconeIndex(client, indexName, vectorDimensions);
    res.status(200).json({ message: `Index created: ${indexName}` });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/ingest-documents', upload.array('files'), async (req, res) => {
  const files = (req as any).files;
  const { userId } = req.body;
  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  });
  console.log({
    apiKey: process.env.PINECONE_API_KEY || '',
    environment: process.env.PINECONE_ENVIRONMENT || '',
  });
  console.log('hoogiaaaa');
  let docs: any[] = [];
  let lastIngestedDoc = '';
  try {
    if (!indexName) {
      return res.status(400).json({ message: 'Index name is required' });
    }

    if (!userId) {
      return res.status(400).json({
        message: 'User id is required',
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const file = files[0];
    const blob = new Blob([file.buffer]);
    const pdfLoader = new PDFLoader(blob);
    const doc = await pdfLoader.load();
    docs.push(...doc);
    lastIngestedDoc = file?.originalname;

    try {
      await updatePineconeWithDocs(client, indexName, docs, userId);
      res.status(200).json({
        message: `Data loaded into index: ${indexName}`,
        userId,
        LastPineconeIngestedDocument: lastIngestedDoc,
      });
    } catch (err) {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: `Error while ingesting document - ${err}` });
  }
});

const chatHistory: { [key: string]: string[] } = {};

app.post('/api/chat', async (req, res) => {
  const body = req.body;
  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  });

  if (!body.question) {
    return res.status(400).json({ message: 'Question is required' });
  }

  try {
    console.log({ sessionId: req.session.id });
    if (!chatHistory[req.session.id]) {
      chatHistory[req.session.id] = [];
    }

    const history = chatHistory[req.session.id];

    const text = await queryPineconeVectorStoreAndQueryLLM(
      client,
      indexName,
      body.question,
      body.username,
      body.userId,
      history,
    );

    chatHistory[req.session.id].push(`user: ${body.question}`);
    chatHistory[req.session.id].push(`bot: ${text}`);

    res.json({
      data: text,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/ingest-posts', upload.none(), async (req, res) => {
  const { post } = req.body;
  console.log(req.body);
  if (!post) {
    return res.status(400).json({ message: 'Missing post data' });
  }

  try {
    const client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });

    const summary = await summarizePost(post);
    await updatePineconeWithText({
      client,
      indexName,
      text: summary,
      dataKey: postDataKey,
      uniqueId: uuidv4(),
    });

    res.status(200).json({
      message: 'Post ingested',
      postSummary: summary,
    });
  } catch (err) {
    console.error('Error ingesting post:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/ingest-blogs', upload.none(), async (req, res) => {
  const { blog, LastPineconeIngestedVectorIdIndex } = req.body;
  console.log(req.body, LastPineconeIngestedVectorIdIndex);
  if (!blog) {
    return res.status(400).json({ message: 'Missing blog data' });
  }

  if (!LastPineconeIngestedVectorIdIndex) {
    return res
      .status(400)
      .json({ message: 'Last pinecone ingested vector id index is required' });
  }

  try {
    const client = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });

    const summary = await summarizeBlog(blog);
    await updatePineconeWithText({
      client,
      indexName,
      text: summary,
      dataKey: blogDataKey,
      uniqueId: uuidv4(),
    });

    res.status(200).json({
      message: 'Blog ingested',
      blogSummary: summary,
    });
  } catch (err) {
    console.error('Error ingesting blog:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
