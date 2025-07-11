import Airtable from "airtable";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, pageNumber, serializedJournalEntry } = req.body;

  // Validate inputs with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }
  const pageNumberRegex = /^\d+$/;
  if (!pageNumber || !pageNumberRegex.test(pageNumber)) {
    return res.status(400).json({ message: "Invalid or missing pageNumber" });
  }
  if (
    typeof serializedJournalEntry !== "string" ||
    serializedJournalEntry.length === 0
  ) {
    return res
      .status(400)
      .json({ message: "Invalid or missing serializedJournalEntry" });
  }

  if (!token || typeof pageNumber === "undefined" || !serializedJournalEntry) {
    return res
      .status(400)
      .json({
        message: "Token, pageNumber, and serializedJournalEntry are required",
      });
  }

  if (Number(pageNumber) === 0) {
    return res.status(200).json({ message: "Ignored: pageNumber is zero" });
  }

  const generatePageID = () => Math.random().toString(36).substr(2, 10);

  try {
    // Find the neighbor record by token
    const neighborRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();
    if (neighborRecords.length === 0) {
      return res.status(404).json({ message: "Neighbor not found" });
    }
    const neighborToken = neighborRecords[0].fields.token;
    const neighborId = neighborRecords[0].id;

    // Look up by neighborToken + pageNumber
    const existingPages = await base("journalPages")
      .select({
        filterByFormula: `AND({neighborToken} = '${neighborToken}', {pageNumber} = ${pageNumber})`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingPages.length > 0) {
      // Update existing record
      await base("journalPages").update(existingPages[0].id, {
        serializedJournalEntry,
        pageNumber,
      });
      return res
        .status(200)
        .json({
          message: "Journal page updated",
          pageID: existingPages[0].fields.PageID,
        });
    } else {
      // Create new record with random PageID
      const newPageID = generatePageID();
      await base("journalPages").create([
        {
          fields: {
            PageID: newPageID,
            pageNumber,
            serializedJournalEntry,
            neighbor: [neighborId],
          },
        },
      ]);
      return res
        .status(201)
        .json({ message: "Journal page created", pageID: newPageID });
    }
  } catch (error) {
    console.error("Airtable Error:", error);
    return res
      .status(500)
      .json({ message: "Error editing journal page", error: error.message });
  }
}
