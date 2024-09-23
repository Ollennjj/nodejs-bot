import { OpenAI } from "langchain/llms/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";

const CONDENSE_PROMPT = (chatHistory: string, question: string) => `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
${chatHistory}
Follow Up Input: ${question}
Standalone question:`;

const QA_PROMPT = (question: string) => `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.

Question: ${question}
Helpful answer in markdown:`;

const makeChain = (vectorStore: any, question: string, chatHistory: string[]) => {
  const chatHistoryString = chatHistory.join("\n");
  const model = new OpenAI({
    temperature: 0, // increase temperature to get more creative answers
    modelName: "gpt-4o-mini", //change this to gpt-4 if you have access
  });

  console.log("Creating chain with question:", question);
  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      qaTemplate: QA_PROMPT(question),
      questionGeneratorTemplate: CONDENSE_PROMPT(chatHistoryString, question),
    }
  );
  return chain;
};

export { makeChain };
