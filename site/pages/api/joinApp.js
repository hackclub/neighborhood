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
    // Get user data from token - using escapeString to prevent formula injection
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRecords[0].id;

    // Get the app - using proper ID format validation (already validated above)
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
    const currentNeighbors = app.fields.Neighbors || [];

    // Check if app is joinable
    const isJoinable = app.fields.is_joinable || false;
    if (!isJoinable) {
      return res
        .status(403)
        .json({ message: "This app is not currently joinable" });
    }

    // Check if user is already a member
    if (currentNeighbors.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You're already a member of this app" });
    }

    // Add user to the app's Neighbors
    const updatedApp = await base("Apps").update([
      {
        id: appId,
        fields: {
          Neighbors: [...currentNeighbors, userId],
        },
      },
    ]);

    // Get the complete app details
    const completeApp = await base("Apps").find(appId);

    // Format the response with all necessary fields
    const appData = {
      id: completeApp.id,
      name: completeApp.fields.Name || "",
      icon: completeApp.fields.Icon || null,
      appLink: completeApp.fields["App Link"] || "",
      githubLink: completeApp.fields["Github Link"] || "",
      description: completeApp.fields.Description || "",
      createdAt: completeApp.fields.createdAt || null,
      images: completeApp.fields.Images
        ? completeApp.fields.Images.split(",")
        : [],
    };

    return res.status(200).json({
      message: "Successfully joined app",
      app: appData,
    });
  } catch (error) {
    console.error("Error joining app:", error);
    return res.status(500).json({ message: "Failed to join app" });
  }
}
