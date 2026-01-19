## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set the `HUGGINGFACE_TOKEN` to your HuggingFace API token
3. Run the app:
   `npm run dev`

## Web UI Submission Requirements

### Framework & Hosting
Submissions must be built in React and deployed on the Vercel or Netlify platforms (template is provided for Vercel) via a public GitHub repository.

### API Integration
All LLM calls and integrations within the Web UI must utilize OpenAI-compatible APIs and the official OpenAI client SDKs.

### API Key Security
Integration of LLM calls must be handled through Vercel/Netlify Functions (serverless). Never expose API keys in client-side environments, such as the browser.
