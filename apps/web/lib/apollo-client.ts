import { HttpLink } from "@apollo/client";
import { ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";

export function makeClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql",
    }),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            jobs: {
              // Each filter gets its own cached list; `after` pages are appended.
              keyArgs: ["filter"],
              merge(existing, incoming, { args }) {
                if (!args?.after) return incoming;
                return { ...incoming, edges: [...(existing?.edges ?? []), ...incoming.edges] };
              },
            },
          },
        },
      },
    }),
  });
}
