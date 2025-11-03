<div align="center">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1>AI Chatbot</h1>
</div>

<p align="center">
    A free, open-source AI chatbot template built with Next.js and the AI SDK that helps you quickly build powerful conversational applications.
</p>

<p align="center">
  <a href="#demo"><strong>Demo</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#model-providers"><strong>Model Providers</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a> ·
  <a href="#running-locally"><strong>Running Locally</strong></a>
</p>
<br/>

## Demo

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/4afd045d70f548419b661522990fe488" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance

- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://neon.tech) for saving chat history and user data
  - Storage solution for efficient file management
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication
  
## Deployment

This application can be deployed to any platform that supports Next.js applications, including:

- Container platforms (Docker, Kubernetes)
- Serverless platforms
- Traditional hosting services

Make sure to configure your environment variables properly for your chosen deployment platform.

## Running Locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run the AI Chatbot locally.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

### Setup Steps

1. Clone the repository
2. Add `.env.local` and fill in your environment variables
3. Install dependencies:

```bash
bun install
```

4. Run the development server:

```bash
bun dev
```

Your app should now be running on [localhost:3000](http://localhost:3000).

## Environment Variables

Key environment variables you'll need to configure:

- `DATABASE_URL` - Your Postgres database connection string
- `AUTH_SECRET` - Secret key for authentication
- API keys for your chosen AI model provider(s)
- Storage configuration (if using file uploads)


## License

This project is open source and available under the MIT License.
