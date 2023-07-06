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


  /*
  const gremlin = require('gremlin');
  const { CosmosClient } = require('@azure/cosmos');

  // Function to execute the Gremlin query against Cosmos DB
  async function executeGremlinQuery(query) {
    const endpoint = 'your_cosmosdb_endpoint';
    const key = 'your_cosmosdb_primary_key';
    const database = 'your_cosmosdb_database';
    const container = 'your_cosmosdb_container';

    const client = new CosmosClient({ endpoint, key });
    const { database: db } = await client.databases.createIfNotExists({ id: database });
    const { container: cntnr } = await db.containers.createIfNotExists({ id: container });

    const { resources: results } = await cntnr.items.query(query, { enableCrossPartitionQuery: true }).fetchAll();
    return results;
  }
  */

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

    // method to extract and send metadata
    // const matchingDocument = response.data[0];
    // const metadata = matchingDocument.meta;

    /*
  // Execute the Gremlin query
    const query = `
      g.V().hasLabel('webpages').has('webpages', 'UI Settings')
      .repeat(bothE('button').otherV())
      .until(hasLabel('webpages').has('webpages', 'GeniusPLUS launch'))
      .path().by(valueMap('webpages')).by(valueMap('subLabel', 'label'))
      .limit(1)
    `;
    const results = await executeGremlinQuery(query);

    // Process the results and extract the desired information
    const cosmosdbResult = {
      startPage: results[0]['objects'][0]['webpages'][0],
      goalPage: results[0]['objects'][results[0]['objects'].length - 1]['webpages'][0],
      buttonClicks: results[0]['objects']
        .slice(1, -1)
        .filter((edge) => 'subLabel' in edge)
        .map((edge) => edge['subLabel']),
    };

    res.status(200).json(cosmosdbResult);
    */

    // res.status(200).json(metadata);

    console.log('response', response);
    res.status(200).json(response);
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
