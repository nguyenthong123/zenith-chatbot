<a href="https://zenith-chatbot.vercel.app">
  <img alt="Zenith Chatbot" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Zenith Chatbot</h1>
</a>

<p align="center">
  Zenith Chatbot is an open-source AI chat application built with <strong>Next.js App Router</strong> and the <strong>Vercel AI SDK</strong>.
  It supports multiple frontier models via Vercel AI Gateway and features ultra-fast inference through <strong>Groq</strong> and web search via <strong>Tavily</strong>.
</p>

<p align="center">
  <a href="https://zenith-chatbot.vercel.app"><strong>Live Demo</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#environment-variables"><strong>Environment Variables</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## Features

- **[Next.js](https://nextjs.org) App Router** — Advanced routing, React Server Components, and Server Actions for high performance
- **[AI SDK](https://ai-sdk.dev/docs/introduction)** — Unified API for text generation, structured outputs, and tool calls across multiple LLM providers
- **Multi-model support via [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)** — Google Gemini, Groq (Llama 3), DeepSeek, Mistral, Moonshot, OpenAI, and xAI
- **Ultra-fast inference with [Groq](https://groq.com)** — Llama 3.3 70B and Mixtral 8x7B served at blazing speed
- **Web search with [Tavily](https://tavily.com)** — Real-time search results integrated into chat responses
- **[shadcn/ui](https://ui.shadcn.com)** — Accessible component primitives styled with [Tailwind CSS](https://tailwindcss.com)
- **Data persistence** — [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for chat history and [Vercel Blob](https://vercel.com/storage/blob) for file storage
- **Authentication** — Secure session management with [Auth.js](https://authjs.dev)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | ✅ Yes | Random secret for Auth.js — generate with `openssl rand -base64 32` |
| `AI_GATEWAY_API_KEY` | ✅ Yes (non-Vercel) | Vercel AI Gateway API key; automatically handled on Vercel via OIDC |
| `POSTGRES_URL` / `DATABASE_URL` | ✅ Yes | Postgres connection string (e.g. Neon) |
| `BLOB_READ_WRITE_TOKEN` | ✅ Yes | Vercel Blob token for file uploads |
| `REDIS_URL` | Optional | Redis connection string for rate limiting / caching |

> **Note:** Never commit your `.env.local` file — it is already in `.gitignore`.

## Running Locally

1. Install dependencies:

```bash
pnpm install
```

2. Set up your environment variables (see [Environment Variables](#environment-variables) above).

3. Run the database migration:

```bash
pnpm db:migrate
```

4. Start the development server:

```bash
pnpm dev
```

Your app is now running at [http://localhost:3000](http://localhost:3000).

