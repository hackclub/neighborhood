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

    // Get all games in the system (isHacktendo true)
    const allGames = await base("Apps")
      .select({
        fields: [
          "Name",
          "Icon",
          "Description",
          "Neighbors",
          "createdAt",
          "isHacktendo",
        ],
        filterByFormula: "{isHacktendo} = 1",
      })
      .all();

    // Filter out games that the user is already a member of
    const availableGames = allGames
      .filter((game) => {
        const neighbors = game.fields.Neighbors || [];
        return !neighbors.includes(userId);
      })
      .map((game) => ({
        id: game.id,
        name: game.fields.Name || "Unnamed Game",
        icon: game.fields.Icon
          ? typeof game.fields.Icon === "string"
            ? game.fields.Icon
            : Array.isArray(game.fields.Icon) && game.fields.Icon.length > 0
              ? game.fields.Icon[0].url
              : null
          : null,
        description: game.fields.Description
          ? game.fields.Description.substring(0, 1000)
          : "",
        memberCount: (game.fields.Neighbors || []).length,
        createdAt: game.fields.createdAt || null,
      }));

    // Sort games by member count (descending) to show popular games first
    const sortedGames = availableGames.sort(
      (a, b) => b.memberCount - a.memberCount,
    );

    return res.status(200).json({ games: sortedGames });
  } catch (error) {
    console.error("Error fetching available games:", error);
    console.error("Detailed error information:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    return res.status(500).json({ message: "Error fetching available games" });
  }
}
