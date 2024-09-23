import { PineconeClient } from "@pinecone-database/pinecone";
import dotenv from 'dotenv';

dotenv.config();

async function initPinecone(): Promise<PineconeClient> {
  try {
    const pinecone = new PineconeClient();

    await pinecone.init({
      environment: process.env.PINECONE_ENVIRONMENT!, // Assuming ENV is always defined in your environment
      apiKey: process.env.PINECONE_API_KEY!,
    });

    return pinecone;
  } catch (error) {
    console.log("error", error);
    throw new Error("Failed to initialize Pinecone Client");
  }
}

const pinecone = async (): Promise<PineconeClient> => await initPinecone();

export {
  pinecone,
};
