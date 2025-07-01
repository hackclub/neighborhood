import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, appId } = req.query;

  if (!token || !appId) {
    return res.status(400).json({ message: "Token and appId are required" });
  }

  // Check token and app id with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/; // Airtable record ID format

  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }
  if (!recordIdRegex.test(appId)) {
    return res.status(400).json({ message: "Invalid app ID format" });
  }

  try {
    // First, find the user by token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Looking for submission with appId:", appId);

    // Get all submissions and filter manually since Airtable returns Apps as an array
    const allSubmissions = await base("YSWS Project Submission")
      .select({
        filterByFormula: "NOT({app} = BLANK())",
        maxRecords: 100,
      })
      .firstPage();

    console.log("Total submissions:", allSubmissions.length);

    // Find the submission where the Apps array contains our appId
    const submission = allSubmissions.find((sub) => {
      const apps = sub.fields.app;
      console.log(
        "Checking submission app:",
        apps,
        "Type:",
        typeof apps,
        "Is Array:",
        Array.isArray(apps),
      );
      return Array.isArray(apps) && apps.includes(appId);
    });

    if (submission) {
      console.log("Found matching submission:", submission.id);
      return res.status(200).json({
        submission: submission,
      });
    }

    console.log("No matching submission found");
    return res
      .status(404)
      .json({ message: "No submission found for this app" });
  } catch (error) {
    console.error("Error fetching submission:", error);
    return res.status(500).json({
      message: "Error fetching submission",
      error: error.message,
    });
  }
}
