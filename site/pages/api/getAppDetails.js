import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

// Validation regex patterns
const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, appId } = req.query;

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
    console.log(`Fetching app details for app ID: ${appId}`);

    // Get user data from token - escape single quotes to prevent formula injection
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
    console.log(`User found with ID: ${userId}`);

    // Get the app - appId has already been validated with regex
    const appRecords = await base("Apps")
      .select({
        filterByFormula: `RECORD_ID() = '${appId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (appRecords.length === 0) {
      console.log(`No app found with ID: ${appId}`);
      return res.status(404).json({ message: "App not found" });
    }

    const app = appRecords[0];
    console.log(`App found: ${app.fields.Name}`);
    console.log(`App fields: ${Object.keys(app.fields).join(", ")}`);

    const neighbors = app.fields.Neighbors || [];
    console.log(`App neighbors: ${neighbors}`);

    // Check if user is a member of this app
    if (!neighbors.includes(userId)) {
      console.log(
        `User ${userId} is not a member of this app's neighbors: ${neighbors}`,
      );
      return res
        .status(403)
        .json({
          message: "You don't have permission to view this app's details",
        });
    }

    // Format the app data
    // Handle the Icon field - can be either a URL string or an attachment array
    let iconUrl = null;
    if (app.fields.Icon) {
      if (typeof app.fields.Icon === "string") {
        // Direct URL string
        iconUrl = app.fields.Icon;
      } else if (Array.isArray(app.fields.Icon) && app.fields.Icon.length > 0) {
        // Attachment array
        iconUrl = app.fields.Icon[0].url;
      }
      console.log(`Icon URL found: ${iconUrl}`);
    }

    // Fetch project names for the hackatime projects
    let projectNames = [];
    if (
      app.fields.hackatimeProjects &&
      app.fields.hackatimeProjects.length > 0
    ) {
      console.log("\n=== FETCHING HACKATIME PROJECTS ===");
      console.log("Current User ID:", userId);
      console.log("Project IDs:", app.fields.hackatimeProjects);

      try {
        // Validate all project IDs before creating formula
        const validProjectIds = app.fields.hackatimeProjects.filter((id) =>
          recordIdRegex.test(id),
        );
        const projectRecords = await base("hackatimeProjects")
          .select({
            filterByFormula: `OR(${validProjectIds.map((id) => `RECORD_ID() = '${id}'`).join(",")})`,
            fields: ["name", "neighbor", "Apps"],
          })
          .all();

        console.log("Found projects:", projectRecords.length);
        projectRecords.forEach((record) => {
          const name =
            record.fields.name ||
            record.fields.Name ||
            record.fields.PROJECT_NAME;
          console.log(`Project ${record.id} details:`, {
            name,
            neighborIds: record.fields.neighbor || [],
            apps: record.fields.Apps || [],
            currentUserId: userId,
            isUserNeighbor: (record.fields.neighbor || []).includes(userId),
          });
          if (name) projectNames.push(name);
        });

        console.log("Project names:", projectNames);
      } catch (error) {
        console.error("Error fetching project names:", error);
      }
    }

    const appData = {
      id: app.id,
      name: app.fields.Name || "",
      icon: iconUrl,
      appLink: app.fields["App Link"] || "",
      githubLink: app.fields["Github Link"] || "",
      description: app.fields.Description || "",
      createdAt: app.fields.createdAt || null,
      images: app.fields.Images ? app.fields.Images.split(",") : [],
      hackatimeProjects: projectNames,
    };

    console.log(`Returning app data for: ${appData.name}`);
    console.log("With hackatime projects:", appData.hackatimeProjects);

    return res.status(200).json({
      app: appData,
    });
  } catch (error) {
    console.error("Error fetching app details:", error);
    console.error("Detailed error info:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    // Don't expose detailed error messages to client
    return res.status(500).json({ message: "Error fetching app details" });
  }
}
