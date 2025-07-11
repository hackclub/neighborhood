import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, projectName, githubLink } = req.body;

  // Sanitize everything with regex

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  const projectNameRegex = /^[A-Za-z0-9\s_-]{3,50}$/; // Adjust length as needed
  const githubLinkRegex =
    /^(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;
  if (
    !tokenRegex.test(token) ||
    !projectNameRegex.test(projectName) ||
    !githubLinkRegex.test(githubLink)
  ) {
    return res.status(400).json({ message: "Invalid input format" });
  }

  if (!token || !projectName || !githubLink) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Find the record for this project
    const records = await base("hackatimeProjects")
      .select({
        filterByFormula: `{name} = '${projectName}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Now check if neighbor's token == token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();
    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const userRecord = userRecords[0];
    const userEmail = userRecord.fields.email || userRecord.id;
    const projectRecord = records[0];
    const projectNeighbors = projectRecord.fields.neighbor || [];
    if (!projectNeighbors.includes(userRecord.id)) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this project" });
    }

    // Update the record with the new GitHub link
    const record = records[0];
    await base("hackatimeProjects").update(record.id, {
      githubLink: githubLink,
    });

    return res
      .status(200)
      .json({ message: "GitHub link updated successfully" });
  } catch (error) {
    console.error("Error updating GitHub link:", error);
    return res
      .status(500)
      .json({ message: "Failed to update GitHub link", error: error.message });
  }
}
