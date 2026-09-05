module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { code, redirect_uri } = req.body || {};
    if (!code || !redirect_uri) {
      return res.status(400).json({ error: "Missing code or redirect_uri" });
    }

    const params = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: "authorization_code"
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(400).json({ error: data.error_description || data.error || "Token exchange failed" });
    }

    // refresh_token is only returned the FIRST time a user consents (or when prompt=consent forces re-issue).
    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
