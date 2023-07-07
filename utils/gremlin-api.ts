const gremlin = require('gremlin');

export async function executeGremlinQuery(query: any) {
    const endpoint = process.env.ENDPOINT;
    const key = process.env.KEY;
    const database = process.env.DATABASE;
    const container = process.env.CONTAINER;
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

    try {
        const result = await client.submit(query, {});
        return result.toArray();
    } catch (error) {
        throw error;
    } finally {
        client.close();
    }
}
