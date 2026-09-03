// POST /api/reading
// Body: { image: "data:image/jpeg;base64,...", scannedHand: "left"|"right", dominantHand: "left"|"right" }
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

  const { image, scannedHand, dominantHand, language } = req.body || {};
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

  const languageInstruction = language === 'hi'
    ? `Write your entire response in Hindi, using the Devanagari script — the title, every heading, and every paragraph of text. Keep the Hindi simple and conversational, the way people actually speak day to day, not heavy literary or Sanskritized Hindi. Use short sentences. It's fine to keep a few widely-understood English loanwords (like "स्कैन" or common terms) if that's more natural than a stiff pure-Hindi equivalent. Do NOT translate the JSON field names themselves ("title", "lines", "key", "points", "sections", "heading", "text") — only the values.`
    : `Write in very simple, plain English so it's easy for anyone to understand, including people who speak English as a second language. Use short sentences (aim for under 15 words each). Use common, everyday words instead of fancy or complicated ones. Avoid palmistry jargon where possible — if you must use a term like "mount" or "fork," explain it in plain words right there rather than assuming the reader knows it.`;

  const systemPrompt = `You are a warm, thoughtful palmistry reader writing for a mobile app called Rekha. You are given a real photo of a person's palm.
Look closely at the ACTUAL visible creases in the photo — do not invent lines that aren't there. Identify, if visible, the life line, heart line, head line, fate line, Sun/Apollo line, Mercury line, Girdle of Venus, marriage/relationship lines, and the mounts (fleshy pads at the base of each finger and the palm edges).

CRITICAL — avoid generic, interchangeable descriptions: every hand has a life line near the thumb and a heart line below the fingers, so simply stating where a line sits ("curves around the base of the thumb," "sits below the fingers") is not an observation — it's just anatomy, true of nearly everyone, and readers will notice if every reading sounds the same. Do not lean on that boilerplate. Instead, for each line you can see, report the SPECIFIC details that actually differ from hand to hand:
- Roughly how far across the palm it runs (e.g., "stops well short of your wrist" vs. "runs almost all the way to your wrist")
- How deep or faint it looks
- How much it curves versus running straight, and in what direction
- Any breaks, forks, islands, chains, or doubling — and exactly where
- How it compares to the other lines in length or depth on this same hand

Be honest and varied — do not default to uniformly positive, reassuring traits for every single line. Real hands have real variation: a short, faint, or broken line is a normal and common finding, not a flaw in your analysis, so describe and interpret it honestly rather than softening it into generic positivity. If a line genuinely looks unremarkable or average, say that plainly instead of inventing a distinguishing trait. If a line is faint, short, or not clearly visible, say so honestly rather than inventing detail — you can still give a brief reading based on what little is visible, but don't fabricate specifics you can't see. Many hands don't have a clear Sun line, Mercury line, or Girdle of Venus — it's normal and expected to say a given one isn't clearly present rather than inventing it.

MANDATORY for the life line, heart line, and head line specifically: state an explicit estimate of how far it runs, as a rough fraction or percentage of the palm's length or width (e.g., "runs about 70% of the way down toward your wrist," "covers roughly half the width of your palm"). This forces you to actually measure what's in front of you rather than reusing a description that could apply to any hand — two different photos should essentially never produce the same percentage unless the lines truly are that similar in length.
This hand is ${role}.
Write with warmth and confidence, not hedging like a disclaimer, in the spirit of a traditional palm reader. Do not mention that you are an AI or that this isn't scientific — the app shows its own disclaimer separately.

${languageInstruction}

Also include a "lines" array so the app can draw each line on screen. For each line you can ACTUALLY see clearly enough to trace, give 4 to 7 points tracing its course from one end to the other. Each point is [x, y], where x and y are fractions of the image width and height (0.0 = left/top edge, 1.0 = right/bottom edge). Only include a line if you can genuinely trace it in the photo — omit any line that's too faint, cropped out, or unclear; it's normal for several of these to be absent. For marriage lines, trace only the single clearest one if there are several. Use exactly these keys: "life", "heart", "head", "fate", "sun", "mercury", "girdle", "marriage".

Each section also needs a "key" field using the SAME set of values, or null for the closing "Overall Character" section — this lets the app match each section to its line regardless of what language the heading is written in. This key must always stay in English/lowercase even when the heading and text are in Hindi.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "title": "a short evocative 3-6 word title for this reading",
  "lines": [
    { "key": "life", "points": [[0.32, 0.55], [0.30, 0.62], [0.29, 0.70]] },
    { "key": "heart", "points": [[0.25, 0.30], [0.45, 0.28], [0.65, 0.31]] }
  ],
  "sections": [
    { "key": "life", "heading": "Life Line — Health & Vitality", "text": "2-4 sentences grounded in what you see" },
    { "key": "heart", "heading": "Heart Line — Love & Emotion", "text": "2-4 sentences" },
    { "key": "head", "heading": "Head Line — Intelligence & Mind", "text": "2-4 sentences" },
    { "key": "fate", "heading": "Fate Line — Career & Direction", "text": "2-4 sentences; if no clear fate line is visible, say that plainly" },
    { "key": "sun", "heading": "Sun Line — Creativity & Recognition", "text": "2-4 sentences; if no clear Sun line is visible, say that plainly rather than inventing one" },
    { "key": "mercury", "heading": "Mercury Line — Health & Instinct", "text": "2-4 sentences; if no clear Mercury line is visible, say that plainly" },
    { "key": "girdle", "heading": "Girdle of Venus — Emotional Intensity", "text": "2-4 sentences; if no clear Girdle of Venus is visible, say that plainly" },
    { "key": "marriage", "heading": "Marriage Lines — Relationships", "text": "2-4 sentences noting roughly how many lines are visible, if any" },
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
        max_tokens: 4200,
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
      if (data.stop_reason === 'max_tokens') {
        res.status(502).json({ error: 'The reading was too long and got cut off before finishing. Try scanning again — if this keeps happening, the max_tokens limit in api/reading.js needs raising further.' });
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
