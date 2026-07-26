const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_HISTORY = 20;

function toGeminiRole(role) {
  return role === 'model' || role === 'assistant' ? 'model' : 'user';
}

async function sendMessage(message, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Chưa cấu hình GEMINI_API_KEY trên server');
    err.status = 500;
    throw err;
  }

  const contents = [
    ...history.slice(-MAX_HISTORY).map((item) => ({
      role: toGeminiRole(item.role),
      parts: [{ text: item.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Lỗi khi gọi Gemini API');
    err.status = response.status;
    throw err;
  }

  const reply = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('');
  return reply || 'Xin lỗi, tôi chưa có câu trả lời cho việc này.';
}

module.exports = { sendMessage };
