import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

// Validation regex patterns
const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: "Missing token" });
  }

  // Validate token format
  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  try {
    // Escape single quotes in token to prevent formula injection
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

    // Get all apps in the system
    const allApps = await base("Apps")
      .select({
        fields: [
          "Name",
          "Icon",
          "Description",
          "Neighbors",
          "createdAt",
          "is_joinable",
        ],
      })
      .all();

    // Filter out apps that the user is already a member of
    const availableApps = allApps
      .filter((app) => {
        const neighbors = app.fields.Neighbors || [];
        const isJoinable = app.fields.is_joinable || false;
        return isJoinable && !neighbors.includes(userId);
      })
      .map((app) => ({
        id: app.id,
        name: app.fields.Name || "Unnamed App",
        icon: app.fields.Icon
          ? typeof app.fields.Icon === "string"
            ? app.fields.Icon
            : Array.isArray(app.fields.Icon) && app.fields.Icon.length > 0
              ? app.fields.Icon[0].url
              : null
          : null,
        description: app.fields.Description
          ? app.fields.Description.substring(0, 1000)
          : "",
        memberCount: (app.fields.Neighbors || []).length,
        createdAt: app.fields.createdAt || null,
      }));

    // Sort apps by member count (descending) to show popular apps first
    const sortedApps = availableApps.sort(
      (a, b) => b.memberCount - a.memberCount,
    );

    return res.status(200).json({ apps: sortedApps });
  } catch (error) {
    console.error("Error fetching available apps:", error);
    console.error("Detailed error information:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    return res.status(500).json({ message: "Error fetching available apps" });
  }
}
