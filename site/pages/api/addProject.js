import Airtable from "airtable";
import { cleanString } from "../../lib/airtable.js";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, projectName, githubLink } = req.body;

  const sanitizedToken = cleanString(token).trim();
  
  const sanitizedProjectName = cleanString(projectName).trim().substring(0, 100);
  
  const sanitizedGithubLink = cleanString(githubLink || "").trim();

  // check token is valid with regecx
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!sanitizedToken || !tokenRegex.test(sanitizedToken)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  if (!sanitizedToken || !sanitizedProjectName) {
    return res
      .status(400)
      .json({ message: "Token and project name are required" });
  }

  try {
    // First, find the user by token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${sanitizedToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRecord = userRecords[0];

    // Check if project already exists
    const existingProjects = await base("hackatimeProjects")
      .select({
        filterByFormula: `{name} = '${sanitizedProjectName}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingProjects.length > 0) {
      return res.status(200).json({
        message: "Project already exists",
        project: existingProjects[0],
      });
    }

    // Add project to hackatimeProjects table
    const projectRecord = await base("hackatimeProjects").create([
      {
        fields: {
          name: sanitizedProjectName,
          githubLink: sanitizedGithubLink,
          neighbor: [userRecord.id], // Link to neighbor record
        },
      },
    ]);

    return res.status(200).json({
      message: "Project added successfully",
      project: projectRecord[0],
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error adding project",
      error: error.message,
    });
  }
}
