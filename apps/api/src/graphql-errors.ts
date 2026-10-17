import { GraphQLError } from "graphql";
import { ValidationError } from "./lib/errors";

// Wrap a service call in a resolver so validation errors reach the client.
// Anything else stays masked by Yoga as "Unexpected error".
export async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError) {
      throw new GraphQLError(e.message, { extensions: { code: "BAD_USER_INPUT" } });
    }
    throw e;
  }
}
