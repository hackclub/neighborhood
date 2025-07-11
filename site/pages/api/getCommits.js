import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token } = req.query;

  // Check token with regex
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

    const userEmail = userRecords[0].fields.email || userRecords[0].id;

    // Get all commits attributed to this user's email
    const commits = await base("commits")
      .select({
        filterByFormula: `{neighbor} = '${userEmail}'`,
        fields: [
          "commitID",
          "message",
          "githubLink",
          "videoLink",
          "commitTime",
          "sessions",
          "neighbor",
          "Type",
          "hackatimeProject",
          "Apps",
        ],
        sort: [{ field: "commitTime", direction: "desc" }],
      })
      .all();

    console.log(
      "Raw commits data from Airtable:",
      JSON.stringify(
        commits.map((c) => ({
          id: c.id,
          commitTime: c.fields.commitTime,
          message: c.fields.message,
          Apps: c.fields.Apps,
        })),
        null,
        2,
      ),
    );

    // Fetch session details and project names for each commit
    const commitsWithDetails = await Promise.all(
      commits.map(async (commit) => {
        console.log("\nProcessing commit:", {
          id: commit.id,
          message: commit.fields.message,
          commitTime: commit.fields.commitTime,
          rawApps: commit.fields.Apps,
        });

        const sessionIds = commit.fields.sessions || [];
        const projectId = commit.fields.hackatimeProject;
        const appIds = commit.fields.Apps || [];
        console.log("Extracted appIds:", appIds);

        // Fetch session details
        let sessionDetails = [];
        if (sessionIds.length > 0) {
          const sessionFilterFormula = sessionIds
            .map((id) => `RECORD_ID()='${id}'`)
            .join(",");
          const formula = `OR(${sessionFilterFormula})`;

          sessionDetails = await base("sessions")
            .select({
              filterByFormula: formula,
              fields: [
                "sessionID",
                "neighbor",
                "startTime",
                "endTime",
                "duration",
                "commit",
                "hackatimeProject",
                "approved",
              ],
            })
            .all();
        }

        // Fetch project name
        let projectName = null;
        if (projectId) {
          const projectRecords = await base("hackatimeProjects")
            .select({
              filterByFormula: `RECORD_ID()='${projectId}'`,
              fields: ["name"],
            })
            .firstPage();

          if (projectRecords.length > 0) {
            projectName = projectRecords[0].fields.name;
          }
        }
        // Fetch app names
        let appNames = [];
        if (appIds.length > 0) {
          console.log("Fetching app names for ids:", appIds);
          const appFilterFormula = appIds
            .map((id) => `RECORD_ID()='${id}'`)
            .join(",");
          const formula = `OR(${appFilterFormula})`;
          console.log("App filter formula:", formula);

          const appRecords = await base("Apps")
            .select({
              filterByFormula: formula,
              fields: ["Name"],
            })
            .all();

          appNames = appRecords.map((record) => record.fields.Name);
          console.log("Found app names:", appNames, "for ids:", appIds);
        } else {
          console.log("No app IDs found for commit");
        }

        return {
          ...commit,
          sessionDetails,
          projectName,
          appNames, // Include the app names in the response
        };
      }),
    );

    return res.status(200).json(commitsWithDetails);
  } catch (error) {
    console.error("Error fetching commits:", error);
    return res
      .status(500)
      .json({ message: "Error fetching commits", error: error.message });
  }
}
