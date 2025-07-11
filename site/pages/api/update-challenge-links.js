import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { projectName, projectDescription, projectRepo } = req.body;

    // Sanitize with regex
    const projectNameRegex = /^[a-zA-Z0-9\s-]{3,100}$/; // Alphanumeric, spaces, hyphens, 3-100 characters
    const projectDescriptionRegex = /^.{10,500}$/; // At least 10 characters, max 500
    const projectRepoRegex =
      /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w- .\/?%&=]*)?$/; // Valid URL format
    if (
      !projectNameRegex.test(projectName) ||
      !projectDescriptionRegex.test(projectDescription) ||
      !projectRepoRegex.test(projectRepo)
    ) {
      return res.status(400).json({ message: "Invalid input format" });
    }

    if (!projectName || !projectDescription || !projectRepo) {
      return res.status(400).json({ message: "Missing required fields" });
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

    // Update the user's record with project details
    await base("Neighbors").update(userRecord.id, {
      projectName: projectName,
      projectDescription: projectDescription,
      githubProject: projectRepo,
    });

    return res.status(200).json({
      success: true,
      message: "Challenge details updated successfully",
    });
  } catch (error) {
    console.error("Error updating challenge details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
