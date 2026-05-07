export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const today = new Date().toISOString().slice(0, 10);
  const dayName = new Date().toLocaleDateString("fr-FR", { weekday: "long" });

  const systemPrompt = `Tu es un expert en calendrier économique forex, spécialisé sur EUR/USD.
Aujourd'hui nous sommes le ${today} (${dayName}).

L'utilisateur trade EUR/USD avec ces deux fenêtres horaires (heure de Paris) :
- FENÊTRE 1 : 08h30 → 12h00 (session Londres)
- FENÊTRE 2 : 13h30 → 15h30 (session New York)

Ta mission : analyser les news économiques du jour impactant EUR/USD et donner un verdict clair.

RÈGLES :
- ROUGE = news rouge (fort impact) dans la fenêtre → NE PAS TRADER
- ORANGE = news orange (impact moyen) → PRUDENCE
- VERT = aucune news importante → TRADER normalement

NEWS importantes EUR/USD : décisions BCE/Fed, NFP, CPI USA/Zone Euro, PIB, PMI, ADP, discours Powell/Lagarde, ISM, ventes au détail US.

RÉPONDS UNIQUEMENT EN JSON STRICT sans markdown :
{
  "date": "${today}",
  "resume_macro": "contexte macro du jour en 2 phrases",
  "fenetre1": {
    "statut": "VERT|ORANGE|ROUGE",
    "verdict": "TRADER|PRUDENCE|NE PAS TRADER",
    "news": [{"heure":"09:00","titre":"CPI Zone Euro","impact":"ROUGE","detail":"explication courte"}],
    "conseil": "conseil en 1 phrase"
  },
  "fenetre2": {
    "statut": "VERT|ORANGE|ROUGE",
    "verdict": "TRADER|PRUDENCE|NE PAS TRADER",
    "news": [],
    "conseil": "conseil en 1 phrase"
  },
  "alertes_hors_fenetres": [
    {"heure":"20:00","titre":"Décision Fed","impact":"ROUGE","detail":"impacte le lendemain"}
  ],
  "bce_fed": {
    "prochaine_bce": "date ou null",
    "prochaine_fed": "date ou null",
    "info": "contexte banques centrales"
  }
}`;

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
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Analyse le calendrier économique d'aujourd'hui ${today} pour EUR/USD. Donne le verdict pour mes deux fenêtres. Réponds uniquement en JSON.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Erreur analyse: " + e.message });
  }
}
