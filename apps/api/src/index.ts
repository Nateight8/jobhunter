import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { db } from "./lib/db";
import { createApplyHandler } from "./modules/apply/apply.http";
import { createDocumentsHandler } from "./modules/documents/documents.http";
import { schema } from "./schema";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const port = Number(process.env.API_PORT ?? 4000);
// Local only by default. Set API_HOST=0.0.0.0 when running inside Docker.
const host = process.env.API_HOST ?? "127.0.0.1";

const yoga = createYoga({ schema, context: () => ({ db }), cors: { origin: webOrigin } });
const documents = createDocumentsHandler(db, webOrigin);
const apply = createApplyHandler(db);

createServer(async (req, res) => {
  if (await documents(req, res)) return;
  if (await apply(req, res)) return;
  yoga(req, res);
}).listen(port, host, () => {
  console.log(`GraphQL API ready at http://localhost:${port}/graphql`);
});
