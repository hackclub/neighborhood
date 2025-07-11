import Airtable from "airtable";

// Add body parser configuration
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.body;

  // Validate token with regex

  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    console.log("Invalid or missing token:", token);
    return res.status(400).json({ error: "Invalid or missing token" });
  }

  // Add debug logging
  console.log("Request body:", req.body);
  console.log("Token received:", token);

  if (!token) {
    console.log("Token is missing from request body");
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    // Initialize Airtable with the correct base ID
    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base(process.env.AIRTABLE_BASE_ID);

    // First, find the neighbor record using the token
    const neighborRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .all();

    if (neighborRecords.length === 0) {
      console.log("No neighbor found with token:", token);
      return res
        .status(404)
        .json({ error: "No neighbor found with this token" });
    }

    const userEmail = neighborRecords[0].fields.email;
    console.log("Found user email:", userEmail);

    // Find and delete the Slack member record
    const slackMemberRecords = await base("#neighborhoodSlackMembers")
      .select({
        filterByFormula: `{Email} = '${userEmail}'`,
      })
      .all();

    if (slackMemberRecords.length === 0) {
      console.log("No Slack member record found for email:", userEmail);
      return res
        .status(404)
        .json({ error: "No Slack member record found for this user" });
    }

    // Delete the record
    await base("#neighborhoodSlackMembers").destroy(slackMemberRecords[0].id);
    console.log("Successfully deleted Slack member record for:", userEmail);

    // Update the neighbor record to remove the slackNeighbor link
    await base("neighbors").update([
      {
        id: neighborRecords[0].id,
        fields: {
          slackNeighbor: null, // This will remove the linked record
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Slack member record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Slack member record:", error);
    return res
      .status(500)
      .json({ error: "Failed to delete Slack member record" });
  }
}
