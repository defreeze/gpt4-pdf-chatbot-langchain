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

    /*
// method to extract and send metadata
response.sourceDocuments.forEach((document: any, index: any) => {
  const source = document.metadata.source;
  console.log(`Metadata for Document ${index + 1}:`, source);
});
*/
    const topDocument = response.sourceDocuments[0];
    console.log('Top document:', topDocument);

    const Goalwebpage = topDocument.metadata.source.split('\\').pop().replace('.pdf', '');
    console.log('Top webpage name:', Goalwebpage);


    function extractPage(text: any) {
      const match = text.match(/am at '(.*?)'/);
      return match ? match[1] : null; // match[1] contains the value between the single quotes
    }

    const Alltxt = sanitizedQuestion;
    console.log('all text:', Alltxt);

    var StartPage = extractPage(Alltxt);
    var GoalPage = Goalwebpage;
    console.log('startpage:', StartPage);
    const timeoutDuration = 2000;
    const query = generateQuery(StartPage, GoalPage);
    const executionPromise = executeGremlinQuery(query);

    const timeoutPromise = new Promise((reject) => {
      setTimeout(() => {
        reject(new Error('Execution timed out.'));
      }, timeoutDuration);
    });

    try {
      const results = await Promise.race([executionPromise, timeoutPromise]);

      if (results && results.length > 0 && results[0].objects) {
        //console.log('Individual Objects:');
        const objectsArray = results[0].objects;
        let outputString = `You are now at ${StartPage} page and you want to go to ${GoalPage} webpage.`;

        for (let i = 0; i < objectsArray.length; i++) {
          const object = objectsArray[i];

          //if (object.waypostDEMO && object.waypostDEMO[0]) {
          //  outputString += ` First click on ${object.waypostDEMO[0]}.`;
          //}

          if (object.subLabel && object.label) {
            outputString += ` Click ${object.subLabel}.`;
          }

          if (i === objectsArray.length - 1 && object.waypostDEMO && object.waypostDEMO[0]) {
            outputString += ` You have arrived at the goal screen ${GoalPage}.`;
          }
        }

        //console.log('outputstring output', outputString);
        response.text = outputString;
        //res.status(200).send(outputString);
      } else if (StartPage == GoalPage) {
        //console.log('You are already at the page where your information can be found.');
        //res.status(200).json('You are already at the page where your information can be found.');
        response.text = 'You are already at the page where your information can be found.'
      }

      else {
        console.log('No results found.');
      }
    } catch (error) {
      console.error('An error occurred:', error);
    }



    console.log('response', response);
    res.status(200).json(response);
  } catch (error: any) {
    console.log('error', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
