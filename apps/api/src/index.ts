import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { db } from "./lib/db";
import { createDocumentsHandler } from "./modules/documents/documents.http";
import { schema } from "./schema";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const port = Number(process.env.API_PORT ?? 4000);
// Local only by default. Set API_HOST=0.0.0.0 when running inside Docker.
const host = process.env.API_HOST ?? "127.0.0.1";

const yoga = createYoga({ schema, context: () => ({ db }), cors: { origin: webOrigin } });
const documents = createDocumentsHandler(db, webOrigin);

createServer(async (req, res) => {
  if (await documents(req, res)) return;
  yoga(req, res);
}).listen(port, host, () => {
  console.log(`GraphQL API ready at http://localhost:${port}/graphql`);
});
