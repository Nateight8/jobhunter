// Plain errors for services. The GraphQL layer translates them (see graphql-errors.ts).
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
