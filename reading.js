// POST /api/reading
// Body: { image: "data:image/jpeg;base64,...", scannedHand: "left"|"right", dominantHand: "left"|"right" }
// Requires env var ANTHROPIC_API_KEY to be set in the Vercel project.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Add it in Vercel Project Settings > Environment Variables.' });
    return;
  }

  const { image, scannedHand, dominantHand } = req.body || {};
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

  const role = scannedHand === dominantHand
    ? 'the hand they actively use — how life and choices have shaped their natural traits'
    : 'their non-dominant hand — the traits and potential they were born with';

  const systemPrompt = `You are a warm, thoughtful palmistry reader writing for a mobile app called Rekha. You are given a real photo of a person's palm.
Look closely at the ACTUAL visible creases in the photo — do not invent lines that aren't there. Identify, if visible:
- The life line (curves around the base of the thumb) — traditionally read for vitality and health
- The heart line (upper horizontal line, below the fingers) — read for emotional life and relationships
- The head line (middle horizontal line) — read for intelligence, thinking style, and decision-making
- The fate/Sun line (vertical line toward the middle/ring finger, not everyone has one) — read for career and money/wealth
- The mounts (fleshy pads at the base of each finger and the palm edges) if visibly pronounced or flat

For each line you can actually see, describe what you observe (length, depth, curve, breaks, forks) and give a traditional palmistry-style interpretation grounded in that observation. If a line is faint, short, or not clearly visible, say so honestly rather than inventing detail — you can still give a brief reading based on what little is visible, but don't fabricate specifics you can't see.
This hand is ${role}.
Write with warmth and confidence, not hedging like a disclaimer, in the spirit of a traditional palm reader. Do not mention that you are an AI or that this isn't scientific — the app shows its own disclaimer separately.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "title": "a short evocative 3-6 word title for this reading",
  "sections": [
    { "heading": "Life Line — Health & Vitality", "text": "2-4 sentences grounded in what you see" },
    { "heading": "Heart Line — Love & Emotion", "text": "2-4 sentences" },
    { "heading": "Head Line — Intelligence & Mind", "text": "2-4 sentences" },
    { "heading": "Fate & Money Line", "text": "2-4 sentences; if no clear fate/Sun line is visible, say that plainly and speak to what the mounts suggest about money instead" },
    { "heading": "Overall Character", "text": "2-4 sentences tying it together" }
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
        max_tokens: 1400,
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
                text: 'Here is the palm photo. Respond with only the JSON object described in the system prompt.',
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
      res.status(502).json({ error: 'Could not parse model response as JSON' });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
}
