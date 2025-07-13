import Airtable from "airtable";
import { cleanString } from "../../lib/airtable.js";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

// Validation regex patterns
const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
const projectNameRegex = /^[\w\s\-().,:;?!'"&+]{1,100}$/;
const urlRegex =
  /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, projectName, githubLink } = req.body;

  if (!token || !projectName || !githubLink) {
    return res
      .status(400)
      .json({ message: "Token, App Name, and GitHub link are required" });
  }

  const cleanedToken = cleanString(token);
  const cleanedProjectName = cleanString(projectName).trim().substring(0, 100);
  const cleanedGithubLink = cleanString(githubLink).trim();

  // Validate token format
  if (!tokenRegex.test(cleanedToken)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  // Validate project name format
  if (!projectNameRegex.test(cleanedProjectName)) {
    return res.status(400).json({ message: "Invalid project name format" });
  }

  // Validate GitHub link format
  if (!urlRegex.test(cleanedGithubLink)) {
    return res.status(400).json({ message: "Invalid GitHub link format" });
  }

  try {
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${cleanedToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userEmail = userRecords[0].fields.email;

    const cleanedUserEmail = cleanString(userEmail);
    const projectRecords = await base("hackatimeProjects")
      .select({
        filterByFormula: `AND({name} = '${cleanedProjectName}', {email} = '${cleanedUserEmail}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (projectRecords.length === 0) {
      const newProject = await base("hackatimeProjects").create([
        {
          fields: {
            name: cleanedProjectName,
            githubLink: cleanedGithubLink,
            email: userEmail,
            neighbor: [userRecords[0].id],
          },
        },
      ]);

      return res.status(200).json({
        message: "Project created with GitHub link",
        project: newProject[0],
      });
    }

    const updatedProject = await base("hackatimeProjects").update([
      {
        id: projectRecords[0].id,
        fields: {
          githubLink: cleanedGithubLink,
        },
      },
    ]);

    return res.status(200).json({
      message: "GitHub link connected successfully",
      project: updatedProject[0],
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    console.error("Detailed error info:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    // Don't expose detailed error messages to client
    return res.status(500).json({
      message: "Error connecting GitHub link",
    });
  }
}
