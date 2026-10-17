import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { db } from "./lib/db";
import { schema } from "./schema";

const yoga = createYoga({
  schema,
  context: () => ({ db }),
  cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" },
});

const port = Number(process.env.API_PORT ?? 4000);
createServer(yoga).listen(port, () => {
  console.log(`GraphQL API ready at http://localhost:${port}/graphql`);
});
