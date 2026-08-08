// Aliased in place of the real 'resend' package for the entire test run
// (see vitest.config.js resolve.alias) — every `new Resend(...)` anywhere in
// the app, in any test, resolves here instead of the real SDK. This is the
// single point that guarantees the suite can never make a real network call
// to Resend, no matter which test file forgets to mock it locally.
export const sentEmails = [];
export let failNextSend = null;

export function __resetResendMock() {
  sentEmails.length = 0;
  failNextSend = null;
}

export function __failNextSend(error) {
  failNextSend = error;
}

export class Resend {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.emails = {
      send: async (payload) => {
        if (failNextSend) {
          const err = failNextSend;
          failNextSend = null;
          return { data: null, error: err };
        }
        sentEmails.push(payload);
        return { data: { id: `test-email-${sentEmails.length}` }, error: null };
      },
    };
  }
}
