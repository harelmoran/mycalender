module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image } = req.body || {}; // full data URL: "data:image/jpeg;base64,...."
    if (!image) return res.status(400).json({ error: "Missing image" });

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing MISTRAL_API_KEY" });

    const now = new Date();
    const currentYear = now.getFullYear();
    const todayISO = now.toISOString().slice(0, 10);

    const prompt = `היום התאריך: ${todayISO}.
זו תמונה שמתארת אירוע (הזמנה, פלייר, הודעת וואטסאפ, כרטיס וכו'). חלץ ממנה את פרטי האירוע והחזר אך ורק אובייקט JSON תקין (בלי מרקדאון, בלי הסברים, בלי טקסט נוסף) עם בדיוק המפתחות הבאים:
- "title": כותרת קצרה ותיאורית של האירוע
- "date": תאריך ההתחלה בפורמט YYYY-MM-DD. אם השנה לא מצוינת, הנח ${currentYear}, אלא אם התאריך הזה כבר עבר השנה — ואז ${currentYear + 1}.
- "endDate": תאריך סיום בפורמט YYYY-MM-DD. זהה ל-"date" אלא אם האירוע נמשך כמה ימים במפורש.
- "allDay": true רק אם אין שום שעה מצוינת בתמונה, אחרת false.
- "startTime": שעת התחלה בפורמט HH:MM (24 שעות), או "" אם לא ידוע.
- "endTime": שעת סיום בפורמט HH:MM (24 שעות), או "" אם לא ידוע.
- "location": מיקום/כתובת/שם אולם אם מצוין, אחרת "".
אם אינך יכול לקבוע בביטחון את תאריך האירוע כלל, הגדר "date" כ-"". אל תמציא פרטים שלא מופיעים בתמונה בפועל. החזר JSON בלבד.`;

    const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: image }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });

    const data = await mistralRes.json();
    if (!mistralRes.ok) {
      const msg = (data && data.message) || (data && data.error && (data.error.message || data.error)) || "Mistral request failed";
      return res.status(mistralRes.status).json({ error: typeof msg === "string" ? msg : JSON.stringify(msg) });
    }

    const rawText = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!rawText) return res.status(500).json({ error: "Empty response from Mistral" });

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Could not parse Mistral response as JSON", raw: rawText });
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
    res.status(500).json({ error: err.message || "Server error" });
  }
};
