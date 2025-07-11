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

  // Validate token and projectName
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }
  if (typeof projectName !== "string" || projectName.trim() === "") {
    return res.status(400).json({ message: "Invalid or missing project name" });
  }

  if (!token || !projectName) {
    return res.status(400).json({ message: "Token and App Name are required" });
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
        filterByFormula: `AND({name} = '${projectName}', {email} = '${userEmail}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (projectRecords.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Update project to remove GitHub link
    const updatedProject = await base("hackatimeProjects").update([
      {
        id: projectRecords[0].id,
        fields: {
          githubLink: "",
        },
      },
    ]);

    return res.status(200).json({
      message: "GitHub link disconnected successfully",
      project: updatedProject[0],
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error disconnecting GitHub link",
      error: error.message,
    });
  }
}
