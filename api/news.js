const handler = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const today = new Date().toISOString().slice(0, 10);
  const dayName = new Date().toLocaleDateString("fr-FR", { weekday: "long" });

  const prompt = "Tu es expert calendrier economique forex EUR/USD. Aujourd'hui " + today + " (" + dayName + "). Fenetres de trading heure Paris : F1=08h30-12h00 Londres, F2=13h30-15h30 New York. Analyse les news du jour impactant EUR/USD. Statut: ROUGE=NE PAS TRADER, ORANGE=PRUDENCE, VERT=TRADER. Reponds UNIQUEMENT en JSON strict sans markdown: {\"date\":\"" + today + "\",\"resume_macro\":\"texte\",\"fenetre1\":{\"statut\":\"VERT\",\"verdict\":\"TRADER\",\"horaire\":\"08h30 - 12h00\",\"news\":[{\"heure\":\"09:00\",\"titre\":\"titre\",\"impact\":\"ROUGE\",\"detail\":\"detail\"}],\"conseil\":\"conseil\"},\"fenetre2\":{\"statut\":\"VERT\",\"verdict\":\"TRADER\",\"horaire\":\"13h30 - 15h30\",\"news\":[],\"conseil\":\"conseil\"},\"alertes_hors_fenetres\":[{\"heure\":\"20:00\",\"titre\":\"Fed\",\"impact\":\"ROUGE\",\"detail\":\"detail\"}],\"bce_fed\":{\"prochaine_bce\":\"date\",\"prochaine_fed\":\"date\",\"info\":\"info\"}}";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = (data.content && data.content[0]) ? data.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "JSON non trouve" });
    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

export default handler;
