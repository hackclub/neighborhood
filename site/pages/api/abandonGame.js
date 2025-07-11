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
    // Get user data from token - escape token to prevent formula injection
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

    // Get the app - appId has already been validated with regex
    const appRecords = await base("Apps")
      .select({
        filterByFormula: `RECORD_ID() = '${appId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (appRecords.length === 0) {
      return res.status(404).json({ message: "Game not found" });
    }

    const app = appRecords[0];
    if (!app.fields.isHacktendo) {
      return res.status(400).json({ message: "Not a Hacktendo game" });
    }
    const currentNeighbors = app.fields.Neighbors || [];

    // Check if user is a member
    if (!currentNeighbors.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You are not a member of this game" });
    }

    // Remove user from the app's Neighbors
    const updatedNeighbors = currentNeighbors.filter((id) => id !== userId);
    await base("Apps").update([
      {
        id: appId,
        fields: {
          Neighbors: updatedNeighbors,
        },
      },
    ]);

    return res.status(200).json({ message: "Successfully abandoned game" });
  } catch (error) {
    console.error("Error abandoning game:", error);
    // Provide more detailed error message for debugging but not to client
    console.error("Error details:", {
      message: error.message,
      statusCode: error.statusCode || 500,
      name: error.name,
    });
    return res.status(500).json({ message: "Failed to abandon game" });
  }
}
