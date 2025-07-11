import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, projectName } = req.body;

  // check token and projectName with a regex

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/; // Example regex for token
  const projectNameRegex = /^[a-zA-Z0-9\s_-]{3,50}$/; // Example regex for project name

  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  if (!token || !projectName) {
    return res
      .status(400)
      .json({ message: "Token and project name are required" });
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

    const userEmail = userRecords[0].fields.email;

    // Find the project record by name and email
    const projectRecords = await base("hackatimeProjects")
      .select({
        filterByFormula: `{name} = '${projectName}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (projectRecords.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Delete the project record
    await base("hackatimeProjects").destroy([projectRecords[0].id]);

    return res.status(200).json({
      message: "Project removed successfully",
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error removing project",
      error: error.message,
    });
  }
}
