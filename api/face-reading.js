// POST /api/face-reading
// Body: { image: "data:image/jpeg;base64,...", language: "en"|"hi" }
// Requires env var ANTHROPIC_API_KEY to be set in the Vercel project.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Add it in Vercel Project Settings > Environment Variables.' });
    return;
  }

  const { image, language } = req.body || {};
  if (!image || typeof image !== 'string' || !image.startsWith('data:image')) {
    res.status(400).json({ error: 'Missing or invalid image' });
    return;
  }

  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Could not parse image data' });
    return;
  }
  const mediaType = match[1];
  const base64Data = match[2];

  const languageInstruction = language === 'hi'
    ? `Write your entire response in Hindi, using the Devanagari script — the title, every heading, and every paragraph of text. Keep the Hindi simple and conversational, the way people actually speak day to day, not heavy literary or Sanskritized Hindi. Use short sentences. Do NOT translate the JSON field names themselves ("title", "points", "key", "point", "sections", "heading", "text") — only the values.`
    : `Write in very simple, plain English so it's easy for anyone to understand, including people who speak English as a second language. Use short sentences (aim for under 15 words each). Use common, everyday words instead of fancy or complicated ones.`;

  const systemPrompt = `You are a warm, thoughtful face reader writing for a mobile app called Rekha. You are given a real photo of a person's face. Give a traditional face-reading (physiognomy) style analysis, in the same spirit as palmistry — a traditional practice read for entertainment and reflection, not a scientific or medical assessment.

Look at these features, if visible, and describe what you actually observe (shape, proportion, spacing) before giving a traditional interpretation grounded in that observation:
- Forehead (height, width, shape) — traditionally read for intellect and early-life outlook
- Eyebrows (shape, thickness, arch) — traditionally read for expressiveness and decisiveness
- Eyes (shape, spacing, size) — traditionally read for perception and emotional depth
- Nose (shape, size, bridge) — traditionally read for ambition and how someone handles resources
- Mouth/lips (shape, fullness) — traditionally read for communication style and warmth
- Chin/jawline (shape, strength) — traditionally read for willpower and determination

CRITICAL — avoid generic, interchangeable descriptions: report the SPECIFIC details that actually differ from face to face (relative proportions, exact shape, how features compare to each other on this same face), not boilerplate that would fit almost anyone. Be honest and varied rather than defaulting to uniformly flattering language — if a feature looks fairly average or ordinary, say so plainly.

STRICT BOUNDARIES — this app is meant to be warm, fun, and respectful:
- NEVER comment on race, ethnicity, or any protected characteristic.
- NEVER comment on attractiveness, weight, age, or give any beauty-related judgment (positive or negative).
- NEVER make any health, medical, or psychological diagnosis or claim.
- NEVER identify or speculate about who the person is.
- Keep every trait interpretation in the same register as a horoscope or palm reading — personality and character only, framed positively or neutrally, never as a flaw or criticism of someone's appearance.

Do not mention that you are an AI or that this isn't scientific — the app shows its own disclaimer separately.

${languageInstruction}

Also include a "points" array so the app can mark each feature on the photo with a small glowing dot. For each feature you discuss, give ONE approximate center point [x, y], where x and y are fractions of the image width and height (0.0 = left/top edge, 1.0 = right/bottom edge). Use exactly these keys: "forehead", "eyebrows", "eyes", "nose", "mouth", "chin".

Each section also needs a "key" field using the SAME set of values, or null for the closing "Overall Character" section — this lets the app match each section to its marker regardless of what language the heading is written in. This key must always stay in English/lowercase even when the heading and text are in Hindi.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "title": "a short evocative 3-6 word title for this reading",
  "points": [
    { "key": "forehead", "point": [0.5, 0.18] },
    { "key": "eyebrows", "point": [0.5, 0.32] }
  ],
  "sections": [
    { "key": "forehead", "heading": "Forehead — Intellect & Outlook", "text": "2-4 sentences grounded in what you see" },
    { "key": "eyebrows", "heading": "Eyebrows — Expression & Decisiveness", "text": "2-4 sentences" },
    { "key": "eyes", "heading": "Eyes — Perception & Depth", "text": "2-4 sentences" },
    { "key": "nose", "heading": "Nose — Ambition & Resourcefulness", "text": "2-4 sentences" },
    { "key": "mouth", "heading": "Mouth — Communication & Warmth", "text": "2-4 sentences" },
    { "key": "chin", "heading": "Chin — Willpower & Determination", "text": "2-4 sentences" },
    { "key": null, "heading": "Overall Character", "text": "2-4 sentences tying it together" }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3400,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              {
                type: 'text',
                text: 'Here is the face photo. Respond with only the JSON object described in the system prompt.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: `Anthropic API error: ${response.status} ${errText.slice(0, 300)}` });
      return;
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      res.status(502).json({ error: 'No text returned from model' });
      return;
    }

    const cleaned = textBlock.text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      if (data.stop_reason === 'max_tokens') {
        res.status(502).json({ error: 'The reading was too long and got cut off before finishing. Try again — if this keeps happening, the max_tokens limit in api/face-reading.js needs raising further.' });
      } else {
        res.status(502).json({ error: `Could not parse model response as JSON (stop_reason: ${data.stop_reason || 'unknown'})` });
      }
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}
