module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image, mimeType } = req.body || {};
    if (!image) return res.status(400).json({ error: "Missing image" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const now = new Date();
    const currentYear = now.getFullYear();

    const prompt = `You are extracting calendar event details from an image. The image could be a wedding invitation, a screenshot of a WhatsApp/text message, a flyer, a ticket, or any other source mentioning an event.

Return ONLY a raw JSON object (no markdown, no explanation) with exactly these keys:
- "title": string, a short descriptive event title
- "date": string in YYYY-MM-DD format (the event's start date). If no year is mentioned, assume ${currentYear}, or ${currentYear + 1} if the mentioned date has already passed this year.
- "endDate": string in YYYY-MM-DD format. Same as "date" unless the event clearly spans multiple days.
- "allDay": boolean, true only if no specific time is mentioned anywhere in the image.
- "startTime": string in 24-hour HH:MM format, or "" if unknown/not applicable.
- "endTime": string in 24-hour HH:MM format, or "" if unknown/not applicable.
- "location": string with the venue/address if mentioned, or "" if none.

If you cannot confidently determine the event's date at all, set "date" to "".
Respond with JSON only.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: image } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      }
    );

    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      return res.status(400).json({ error: (geminiData.error && geminiData.error.message) || "Gemini request failed" });
    }

    const rawText = geminiData.candidates &&
      geminiData.candidates[0] &&
      geminiData.candidates[0].content &&
      geminiData.candidates[0].content.parts &&
      geminiData.candidates[0].content.parts[0] &&
      geminiData.candidates[0].content.parts[0].text;

    if (!rawText) return res.status(500).json({ error: "Empty response from Gemini" });

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Could not parse Gemini response as JSON" });
    }

    res.status(200).json({
      title: parsed.title || "",
      date: parsed.date || "",
      endDate: parsed.endDate || parsed.date || "",
      allDay: !!parsed.allDay,
      startTime: parsed.startTime || "",
      endTime: parsed.endTime || "",
      location: parsed.location || ""
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
