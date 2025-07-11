import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, appId } = req.body;

  // Check the token with a regex

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }

  try {
    // Find the user from token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRecords[0].id;
    console.log("Found user with ID:", userId);

    if (appId) {
      // If appId is provided, just assign the user to that specific app
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

      if (currentNeighbors.includes(userId)) {
        return res
          .status(200)
          .json({ message: "User is already assigned to this app" });
      }

      // Add user to neighbors
      const updatedApp = await base("Apps").update([
        {
          id: appId,
          fields: {
            Neighbors: [...currentNeighbors, userId],
          },
        },
      ]);

      return res.status(200).json({
        message: "User successfully assigned to app",
        app: updatedApp[0].id,
      });
    } else {
      // If no appId is provided, find all unassigned apps and check if any match the current user's
      const allApps = await base("Apps").select().all();

      const unassignedApps = allApps.filter(
        (app) => !app.fields.Neighbors || app.fields.Neighbors.length === 0,
      );

      console.log(`Found ${unassignedApps.length} unassigned apps`);

      // Update them all to include this user
      if (unassignedApps.length > 0) {
        const updates = unassignedApps.map((app) => ({
          id: app.id,
          fields: {
            Neighbors: [userId],
          },
        }));

        const updatedApps = await base("Apps").update(updates);

        return res.status(200).json({
          message: `Successfully assigned user to ${updatedApps.length} app(s)`,
          apps: updatedApps.map((app) => app.id),
        });
      } else {
        return res.status(200).json({
          message: "No unassigned apps found to fix",
        });
      }
    }
  } catch (error) {
    console.error("Error fixing user apps:", error);
    return res
      .status(500)
      .json({ message: "Error fixing user apps", error: error.message });
  }
}
