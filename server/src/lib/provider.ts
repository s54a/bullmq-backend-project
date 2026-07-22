import CircuitBreaker from "opossum";

async function callGroq(messages: any) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: "llama-3.1-8b-instant", messages }),
  });
  if (!res.ok) throw new Error(`Groq Error ${res.status}`);
  return res.json();
}

async function callOpenAI(messages: any) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-3.5-turbo", messages }),
  });
  if (!res.ok) throw new Error(`OpenAI Error ${res.status}`);
  return res.json();
}

const breaker = new CircuitBreaker(callGroq, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

export async function getChatCompletion(messages: any) {
  try {
    return await breaker.fire(messages); // Try Groq
  } catch (err) {
    console.warn("[provider] Groq failed, falling back to OpenAI");
    return await callOpenAI(messages); // Fallback to OpenAI
  }
}
