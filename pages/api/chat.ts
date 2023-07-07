import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';
import { generateQuery } from '@/utils/./cosmosDB-query-gen';
import { executeGremlinQuery } from '@/utils/./gremlin-api';
require('dotenv').config();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body;
  console.log('question', question);

  //only accept post requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }

  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from the config folder
      },
    );

    //create chain
    const chain = makeChain(vectorStore);
    //Ask a question using chat history
    const response = await chain.call({
      question: sanitizedQuestion,
      chat_history: history || [],
    });

    const StartPage = 'UI Settings';
    const GoalPage = 'GeniusPLUS launch';
    const query = generateQuery(StartPage, GoalPage);
    const results: any = await executeGremlinQuery(query);

    console.log('Individual Objects:');
    const objectsArray = results[0].objects;
    objectsArray.forEach((object: any, index: any) => {
      console.log(`Object ${index + 1}:`, object);
    });

    // method to extract and send metadata
    response.sourceDocuments.forEach((document: any, index: any) => {
      const source = document.metadata.source;
      console.log(`Metadata for Document ${index + 1}:`, source);
    });

    console.log('response', response);
    res.status(200).json(response);
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
