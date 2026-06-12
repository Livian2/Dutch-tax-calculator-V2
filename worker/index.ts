// Worker entry point for `wrangler deploy` (Workers static assets mode).
// Static files are served from ./dist by the assets layer; only /api/*
// reaches this Worker (see run_worker_first in wrangler.jsonc), which
// reuses the Yahoo Finance proxy from the Pages Function.

import { onRequest } from '../functions/api/finance/[[path]]';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/finance')) {
      return onRequest({ request, params: {} });
    }
    return new Response('Not found', { status: 404 });
  },
};
