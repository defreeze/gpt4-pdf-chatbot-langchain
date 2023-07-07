import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '@/config/pinecone';

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



  const gremlin = require('gremlin');
  async function executeGremlinQuery(query: any) {
    const endpoint = 'wss://plusdatabase.gremlin.cosmos.azure.com:443';
    const key = 'Tn0VsSxCcH98TmcVpGzELezFsXHnpuWF4XcRgNiSoA1pOL59B1EDjkESKWuMOWqcQa4kZqtrFIAaACDblz5DGw==';
    const database = 'websiteDEMO';
    const container = 'webpages';
    const authenticator = new gremlin.driver.auth.PlainTextSaslAuthenticator(`/dbs/${database}/colls/${container}`, key);

    const client = new gremlin.driver.Client(
      endpoint,
      {
        authenticator,
        traversalsource: "g",
        rejectUnauthorized: true,
        mimeType: "application/vnd.gremlin-v2.0+json"
      }
    );

    return new Promise((resolve, reject) => {
      client.submit(query, {})
        .then((result: any) => {
          resolve(result.toArray());
        })
        .catch((error: any) => {
          reject(error);
        })
        .finally(() => {
          client.close();
        });
    });
  }


  try {
    const index = pinecone.Index(PINECONE_INDEX_NAME);

    /* create vectorstore*/
    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
      },
    );

    //create chain
    const chain = makeChain(vectorStore);
    //Ask a question using chat history
    const response = await chain.call({
      question: sanitizedQuestion,
      chat_history: history || [],
    });

    const query = `
    g.V().hasLabel('webpages').has('webpages', 'UI Settings')
    .repeat(bothE('button').otherV())
    .until(hasLabel('webpages').has('webpages', 'GeniusPLUS launch'))
    .path().by(valueMap('webpages')).by(valueMap('subLabel', 'label'))
    .limit(1)
  `;
    const results: any = await executeGremlinQuery(query);
    //console.log('Results from CosmosDB:', results);

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
