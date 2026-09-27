// An error that is safe to show to the user, with the HTTP status to send.
// Anything else thrown in a route is treated as unexpected and hidden (see index.ts).
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
