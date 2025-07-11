import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

// Validation regex patterns
const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, appId } = req.body;
  console.log("Received request to leave app:", { appId });

  if (!token || !appId) {
    return res.status(400).json({ message: "Token and app ID are required" });
  }

  // Validate token format
  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  // Validate appId format
  if (!recordIdRegex.test(appId)) {
    return res.status(400).json({ message: "Invalid app ID format" });
  }

  try {
    // Get user data from token
    console.log("Fetching user data for token...");
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

    const userId = userRecords[0].id;
    console.log("Found user:", { userId });

    // Get the app to verify membership
    console.log("Fetching app data...");
    // AppId has already been validated with regex
    const appRecords = await base("Apps")
      .select({
        filterByFormula: `RECORD_ID() = '${appId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (appRecords.length === 0) {
      return res.status(404).json({ message: "App not found" });
    }

    const app = appRecords[0];
    console.log("Found app:", {
      appId: app.id,
      hasNeighbors: !!app.fields.Neighbors,
      neighborsCount: (app.fields.Neighbors || []).length,
      commitsCount: (app.fields.Commits || []).length,
      projectsCount: (app.fields.hackatimeProjects || []).length,
      devlogCount: (app.fields.devlog || []).length,
      yswsCount: (app.fields["YSWS Project Submission"] || []).length,
    });

    const currentNeighbors = app.fields.Neighbors || [];
    const currentCommits = app.fields.Commits || [];
    const currentHackatimeProjects = app.fields.hackatimeProjects || [];
    const currentDevlog = app.fields.devlog || [];
    const currentYSWS = app.fields["YSWS Project Submission"] || [];

    // Check if user is a member of this app
    if (!currentNeighbors.includes(userId)) {
      return res
        .status(403)
        .json({ message: "You are not a member of this app" });
    }

    // Remove user from the Neighbors array
    const updatedNeighbors = currentNeighbors.filter((id) => id !== userId);

    // Get all commits to check which ones belong to the leaving user
    console.log("Fetching commits data...");
    console.log("Current commits to check:", currentCommits);
    let updatedCommits = [];
    if (currentCommits.length > 0) {
      // Validate all commit IDs before using them in the formula
      const validCommitIds = currentCommits.filter((id) =>
        recordIdRegex.test(id),
      );
      const safeCommitFormula = validCommitIds
        .map((id) => `RECORD_ID() = '${id}'`)
        .join(",");

      const commitRecords = await base("Commits")
        .select({
          filterByFormula: `OR(${safeCommitFormula})`,
        })
        .all();
      console.log("Found commits:", { count: commitRecords.length });

      // Keep only commits that don't belong to the leaving user
      updatedCommits = commitRecords
        .filter((commit) => {
          const commitNeighbors = commit.fields.neighbor || [];
          return !commitNeighbors.includes(userId);
        })
        .map((commit) => commit.id);
      console.log("Filtered commits:", {
        before: commitRecords.length,
        after: updatedCommits.length,
      });
    }

    // Get all hackatime projects to check which ones belong to the leaving user
    console.log("Fetching hackatime projects...");
    console.log("Current projects to check:", currentHackatimeProjects);
    let updatedHackatimeProjects = [];
    if (currentHackatimeProjects.length > 0) {
      // Sanitize project names to prevent formula injection
      const safeProjectNames = currentHackatimeProjects
        .map((name) => `{name} = '${String(name).replace(/'/g, "\\'")}'`)
        .join(",");

      const hackatimeProjectRecords = await base("hackatimeProjects")
        .select({
          filterByFormula: `OR(${safeProjectNames})`,
        })
        .all();
      console.log("Found projects:", { count: hackatimeProjectRecords.length });

      // Keep only hackatime projects that don't belong to the leaving user
      updatedHackatimeProjects = hackatimeProjectRecords
        .filter((project) => {
          const projectNeighbors = project.fields.neighbor || [];
          return !projectNeighbors.includes(userId);
        })
        .map((project) => project.fields.name);
      console.log("Filtered projects:", {
        before: hackatimeProjectRecords.length,
        after: updatedHackatimeProjects.length,
      });
    }

    // Get all devlog entries to check which ones belong to the leaving user
    console.log("Fetching devlog entries...");
    console.log("Current devlog entries to check:", currentDevlog);
    let updatedDevlog = [];
    if (currentDevlog.length > 0) {
      // Validate all devlog entry IDs before using them in the formula
      const validDevlogIds = currentDevlog.filter((id) =>
        recordIdRegex.test(id),
      );
      const safeDevlogFormula = validDevlogIds
        .map((id) => `RECORD_ID() = '${id}'`)
        .join(",");

      const devlogRecords = await base("Posts")
        .select({
          filterByFormula: `OR(${safeDevlogFormula})`,
        })
        .all();
      console.log("Found devlog entries:", { count: devlogRecords.length });

      // Keep only devlog entries that don't belong to the leaving user
      updatedDevlog = devlogRecords
        .filter((entry) => {
          const entryNeighbors = entry.fields.neighbor || [];
          return !entryNeighbors.includes(userId);
        })
        .map((entry) => entry.id);
      console.log("Filtered devlog entries:", {
        before: devlogRecords.length,
        after: updatedDevlog.length,
      });
    }

    // Get all YSWS Project Submissions to check which ones belong to the leaving user
    console.log("Fetching YSWS submissions...");
    console.log("Current YSWS submissions to check:", currentYSWS);
    let updatedYSWS = [];
    if (currentYSWS.length > 0) {
      // Validate all YSWS submission IDs before using them in the formula
      const validYSWSIds = currentYSWS.filter((id) => recordIdRegex.test(id));
      const safeYSWSFormula = validYSWSIds
        .map((id) => `RECORD_ID() = '${id}'`)
        .join(",");

      const yswsRecords = await base("YSWS Project Submission")
        .select({
          filterByFormula: `OR(${safeYSWSFormula})`,
        })
        .all();
      console.log("Found YSWS submissions:", { count: yswsRecords.length });

      // Keep only YSWS submissions that don't belong to the leaving user
      updatedYSWS = yswsRecords
        .filter((submission) => {
          const submissionNeighbors = submission.fields.neighbor || [];
          return !submissionNeighbors.includes(userId);
        })
        .map((submission) => submission.id);
      console.log("Filtered YSWS submissions:", {
        before: yswsRecords.length,
        after: updatedYSWS.length,
      });
    }

    // Update app record to remove user and their associated data
    console.log("Updating app with filtered data...", {
      neighborsCount: updatedNeighbors.length,
      commitsCount: updatedCommits.length,
      projectsCount: updatedHackatimeProjects.length,
      devlogCount: updatedDevlog.length,
      yswsCount: updatedYSWS.length,
    });

    await base("Apps").update([
      {
        id: appId,
        fields: {
          Neighbors: updatedNeighbors,
          Commits: updatedCommits,
          hackatimeProjects: updatedHackatimeProjects,
          devlog: updatedDevlog,
          "YSWS Project Submission": updatedYSWS,
        },
      },
    ]);

    console.log("Successfully updated app");
    return res.status(200).json({
      message: "Successfully left the app",
    });
  } catch (error) {
    console.error("Error leaving app:", {
      error: error.message,
      code: error.error,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    // Don't expose error details to client for security
    return res.status(500).json({
      message: "Failed to leave app",
    });
  }
}
