import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  const { email } = req.body;

  // sanitize email with regex

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  const records = await base("neighbors")
    .select({
      filterByFormula: `{email} = '${email}'`,
    })
    .all();

  if (records.length === 0) {
    res.status(404).json({ error: "No account found with that email." });
  } else {
    res.status(200).json({ linked: true });
  }
}
