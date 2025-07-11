import Airtable from "airtable";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token } = req.body;

  // Sanitize token with a regex to ensure it matches the expected format

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    // Find all journalPages where neighborToken matches the user's token
    const journalPages = await base("journalPages")
      .select({
        filterByFormula: `{neighborToken} = '${token}'`,
      })
      .all();

    const pages = journalPages.map((page) => ({
      id: page.id,
      pageNumber: page.fields.pageNumber,
      serializedJournalEntry: page.fields.serializedJournalEntry || "",
      PageID: page.fields.PageID || "",
    }));

    return res.status(200).json({ pages });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res
      .status(500)
      .json({ message: "Error fetching journal pages", error: error.message });
  }
}
