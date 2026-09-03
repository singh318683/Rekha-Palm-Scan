// POST /api/compare
// Body: { bornImage: "data:image/jpeg;base64,...", shapedImage: "data:image/jpeg;base64,...",
//         bornHand: "left"|"right", shapedHand: "left"|"right" }
// Requires env var ANTHROPIC_API_KEY to be set in the Vercel project.

function parseImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return null;
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64Data: match[2] };
}

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

  const { bornImage, shapedImage, language } = req.body || {};
  const born = parseImage(bornImage);
  const shaped = parseImage(shapedImage);
  if (!born || !shaped) {
    res.status(400).json({ error: 'Missing or invalid images — need both bornImage and shapedImage' });
    return;
  }

  const languageInstruction = language === 'hi'
    ? `Write your entire response in Hindi, using the Devanagari script — the title, every heading, and every paragraph of text. Keep the Hindi simple and conversational, the way people actually speak day to day, not heavy literary or Sanskritized Hindi. Use short sentences. It's fine to keep a few widely-understood English loanwords if that's more natural than a stiff pure-Hindi equivalent. Do NOT translate the JSON field names themselves ("title", "sections", "heading", "text") — only the values.`
    : `Write in very simple, plain English so it's easy for anyone to understand, including people who speak English as a second language. Use short sentences (aim for under 15 words each). Use common, everyday words instead of fancy or complicated ones. Avoid palmistry jargon where possible — if you must use a term like "mount" or "fork," explain it in plain words right there rather than assuming the reader knows it.`;

  const systemPrompt = `You are a warm, thoughtful palmistry reader writing for a mobile app called Rekha. You are given two real photos of the same person's palms.
The FIRST photo is their non-dominant hand — in palmistry this represents what a person was born with, their innate character and potential.
The SECOND photo is their dominant hand — the hand they actively use — which in palmistry represents what life and their own choices have made of that potential.

Look closely at the ACTUAL visible creases in both photos and compare them line by line: life line, heart line, head line, and fate/Sun line if present. For each, describe what's genuinely different or genuinely similar between the two hands — deeper vs shallower, longer vs shorter, straighter vs more curved, breaks or forks that appear in one but not the other. Ground every claim in what you can actually see; if a line looks essentially unchanged between the two hands, say so plainly rather than inventing a difference.
Write with warmth and confidence, in the spirit of a traditional palm reader, framing differences as "what you were born with" vs "what you've become." Do not mention that you are an AI or that this isn't scientific — the app shows its own disclaimer separately.

${languageInstruction}

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "title": "a short evocative 3-6 word title for this comparison",
  "sections": [
    { "heading": "Life Line — Then & Now", "text": "2-4 sentences comparing the two" },
    { "heading": "Heart Line — Then & Now", "text": "2-4 sentences" },
    { "heading": "Head Line — Then & Now", "text": "2-4 sentences" },
    { "heading": "Fate & Money — Then & Now", "text": "2-4 sentences; note plainly if one or both hands lack a clear fate line" },
    { "heading": "What's Changed", "text": "2-4 sentences tying it together — the overall story of what stayed constant and what life has shaped" }
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
        max_tokens: 2400,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First photo — non-dominant hand (born with):' },
              { type: 'image', source: { type: 'base64', media_type: born.mediaType, data: born.base64Data } },
              { type: 'text', text: 'Second photo — dominant hand (self-made):' },
              { type: 'image', source: { type: 'base64', media_type: shaped.mediaType, data: shaped.base64Data } },
              { type: 'text', text: 'Compare these two hands. Respond with only the JSON object described in the system prompt.' },
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
        res.status(502).json({ error: 'The comparison was too long and got cut off before finishing. Try again — if this keeps happening, the max_tokens limit in api/compare.js needs raising further.' });
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
