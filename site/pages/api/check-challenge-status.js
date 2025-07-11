import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];

    // check if token is valid with regex

    const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
    if (!token || !tokenRegex.test(token)) {
      return res.status(400).json({ message: "Invalid or missing token" });
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Find the user by their token in the Neighbors table
    const records = await base("Neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRecord = records[0];
    const projectName = userRecord.get("projectName");
    const projectDescription = userRecord.get("projectDescription");
    const projectRepo = userRecord.get("githubProject");

    return res.status(200).json({
      isSubmitted: !!(projectName && projectDescription && projectRepo),
      projectName: projectName || "",
      projectDescription: projectDescription || "",
      projectRepo: projectRepo || "",
    });
  } catch (error) {
    console.error("Error checking challenge status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
