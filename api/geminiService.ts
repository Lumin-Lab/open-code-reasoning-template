import OpenAI from 'openai';

const generateDebateResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  lastSpeaker: string
): Promise<string> => {
  const API_KEY = process.env.GEMINI_API_KEY || '';

  if (!API_KEY) {
    console.warn("API Key not found. Returning mock response.");
    return "I need an API key to think of a real response!";
  }

  // Initialize OpenAI client with Gemini's OpenAI-compatible endpoint
  const client = new OpenAI({
    apiKey: API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    dangerouslyAllowBrowser: true // Required for client-side usage
  });

  const model = 'gemini-2.0-flash';

  const systemInstruction = `
    You are simulating a debate between two AI personas: 'Tutor AI' and 'Student AI'.
    The topic is JavaScript 'let' vs 'const'.
    
    Tutor AI: Experienced, patient, precise, uses analogies.
    Student AI: Curious, slightly skeptical of legacy code, asks practical questions.
    
    The last speaker was ${lastSpeaker}. Generate the response for the OTHER speaker.
    Keep it conversational, short (under 2 sentences), and strictly about the code snippet provided.
  `;

  // Construct messages for OpenAI format
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemInstruction }
  ];

  // Map history
  // Gemini history: { role: 'user' | 'model', parts: [{ text: string }] }
  // OpenAI messages: { role: 'user' | 'assistant', content: string }
  history.forEach(msg => {
    messages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.parts[0]?.text || ""
    });
  });

  // Add continuation prompt
  messages.push({
    role: "user",
    content: "Continue the debate."
  });

  try {
    const completion = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.7
    });

    const text = completion.choices[0]?.message?.content;
    return text || "";

  } catch (error) {
    console.error("Error generating debate response:", error);
    return "I'm having trouble thinking right now.";
  }
};

export default {
  async fetch(request: Request) {
    try {
      // Parse request body
      const body = await request.json();
      const { history, lastSpeaker } = body;

      if (!history || !lastSpeaker) {
        return Response.json(
          { error: 'Missing required fields: history and lastSpeaker' },
          { status: 400 }
        );
      }

      // Call the debate response generator
      const response = await generateDebateResponse(history, lastSpeaker);

      return Response.json({ response });
    } catch (error) {
      console.error('Error in fetch handler:', error);
      return Response.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }
  },
};