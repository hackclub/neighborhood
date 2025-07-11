import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  const { userId, token } = req.query;

  // check userID and token with regex (user id is just a airtable )

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/; // Adjust length as needed

  if (!userId || !token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid userId or token format" });
  }

  try {
    // First get the user's email from their token
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

    // Create a Set of attributed App Names for faster lookup
    const attributedProjectNames = new Set(
      attributedProjects.map((record) => record.fields.name),
    );

    // Create a map of GitHub links
    const githubLinks = new Map(
      attributedProjects.map((record) => [
        record.fields.name,
        record.fields.githubLink || "",
      ]),
    );

    console.log(githubLinks);

    // Fetch Hackatime data
    const hackatimeResponse = await fetch(
      `https://hackatime.hackclub.com/api/v1/users/${userId}/stats?features=projects&start_date=2025-04-30`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!hackatimeResponse.ok) {
      throw new Error(
        `Hackatime API responded with status: ${hackatimeResponse.status}`,
      );
    }

    const hackatimeData = await hackatimeResponse.json();

    // Add isChecked and githubLink to each project
    const projectsWithStatus = hackatimeData.data.projects.map((project) => ({
      ...project,
      isChecked: attributedProjectNames.has(project.name),
      githubLink: githubLinks.get(project.name) || "",
    }));
    const hackatimeProjectNames = new Set(
      hackatimeData.data.projects.map((p) => p.name),
    );
    const airtableOnlyProjects = attributedProjects
      .filter((record) => !hackatimeProjectNames.has(record.fields.name))
      .map((record) => ({
        name: record.fields.name,
        isChecked: true,
        githubLink: record.fields.githubLink || "",
        // Add other fields that might be needed
        totalSeconds: 0,
        languages: {},
        source: "airtable", // Add a source identifier if helpful
      }));

    // Combine both sources of projects
    const allProjects = [...projectsWithStatus, ...airtableOnlyProjects];

    // If user has projects, update their hasHackatimeAt timestamp if not already set
    if (allProjects.length > 0) {
      const currentUser = userRecords[0].fields;
      if (!currentUser.hasHackatimeAt) {
        await base(process.env.AIRTABLE_TABLE_ID).update(userRecordId, {
          hasHackatimeAt: new Date().toISOString(),
        });
      }
    }

    res.status(200).json({
      ...hackatimeData,
      data: {
        ...hackatimeData.data,
        projects: allProjects,
      },
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
}
