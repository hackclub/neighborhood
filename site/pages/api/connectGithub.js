import Airtable from "airtable";

// Initialize Airtable
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

  // Validate token format
  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  // Validate project name format
  if (!projectNameRegex.test(projectName)) {
    return res.status(400).json({ message: "Invalid project name format" });
  }

  // Validate GitHub link format
  if (!urlRegex.test(githubLink)) {
    return res.status(400).json({ message: "Invalid GitHub link format" });
  }

  try {
    // First, find the user by token - escape single quotes to prevent formula injection
    const safeToken = token.replace(/'/g, "\\'");
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${safeToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userEmail = userRecords[0].fields.email;

    // Find the project record by name and email - escape inputs to prevent formula injection
    const safeProjectName = projectName.replace(/'/g, "\\'");
    const safeUserEmail = userEmail.replace(/'/g, "\\'");
    const projectRecords = await base("hackatimeProjects")
      .select({
        filterByFormula: `AND({name} = '${safeProjectName}', {email} = '${safeUserEmail}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (projectRecords.length === 0) {
      // If project doesn't exist, create it with the GitHub link
      // Sanitize inputs before storing
      const sanitizedProjectName = projectName.trim().substring(0, 100);
      const sanitizedGithubLink = githubLink.trim();

      const newProject = await base("hackatimeProjects").create([
        {
          fields: {
            name: sanitizedProjectName,
            githubLink: sanitizedGithubLink,
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

    // Update existing project with GitHub link
    // Sanitize GitHub link before storing
    const sanitizedGithubLink = githubLink.trim();

    const updatedProject = await base("hackatimeProjects").update([
      {
        id: projectRecords[0].id,
        fields: {
          githubLink: sanitizedGithubLink,
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
