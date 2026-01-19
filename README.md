## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set the following environment variables for local development:
   - `HUGGINGFACE_TOKEN` - Your HuggingFace API token
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   Prepare the Supabase database.
3. Run the app:
   `npm run dev`

## Web UI Submission Requirements

### Framework & Hosting
Submissions must be built in React and deployed on the Vercel or Netlify platforms (template is provided for Vercel) via a public GitHub repository.

### API Integration
All LLM calls and integrations within the Web UI must utilize OpenAI-compatible APIs and the official OpenAI client SDKs.

### API Key Security
Integration of LLM calls must be handled through Vercel/Netlify Functions (serverless). Never expose API keys in client-side environments, such as the browser.
