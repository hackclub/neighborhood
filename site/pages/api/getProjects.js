import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token } = req.query;

  // Validate token with regex

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  if (!token) {
    return res.status(400).json({ message: "Missing token" });
  }

  try {
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userEmail = userRecords[0].fields.email;
    const userRecordId = userRecords[0].id;

    // Get all projects attributed to this user
    const attributedProjects = await base("hackatimeProjects")
      .select({
        filterByFormula: `{email} = '${userEmail}'`,
        fields: ["name", "githubLink"],
      })
      .all();
    return res.status(200).json(attributedProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ message: "Error fetching projects" });
  }
}
