import { WebClient } from "@slack/web-api";
import Airtable from "airtable";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slackId, token } = req.query;

  // Sanitize slakc id and token with regex

  const slackIdRegex = /^[A-Z0-9]{9,12}$/; // Slack user IDs are typically 9-12 characters long
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/; // Example token format, adjust as needed
  if (!slackId || !slackIdRegex.test(slackId)) {
    return res.status(400).json({ error: "Invalid Slack ID format" });
  }
  if (token && !tokenRegex.test(token)) {
    return res.status(400).json({ error: "Invalid token format" });
  }

  // If token is provided, look up the neighbor by token and get their Slack ID
  if (token) {
    try {
      const records = await base("neighbors")
        .select({
          filterByFormula: `{token} = '${token}'`,
          maxRecords: 1,
        })
        .firstPage();
      if (!records || records.length === 0) {
        return res
          .status(404)
          .json({ error: "No neighbor found for this token" });
      }
      const neighbor = records[0].fields;
      const userId = records[0].id;
      // Try to get slackNeighbor linked record fields as fallback
      let slackNeighborFields = {};
      if (
        neighbor.slackNeighbor &&
        Array.isArray(neighbor.slackNeighbor) &&
        neighbor.slackNeighbor.length > 0
      ) {
        try {
          const slackNeighborRec = await base("#neighborhoodSlackMembers").find(
            neighbor.slackNeighbor[0],
          );
          slackNeighborFields = slackNeighborRec.fields || {};
        } catch (err) {
          // ignore if not found
        }
      }
      // Always return neighbor info if found, using fallbacks from slackNeighbor
      let slackData = {
        slackHandle:
          neighbor.slackHandle || slackNeighborFields["Slack Handle"] || null,
        fullName: neighbor.name || slackNeighborFields["Full Name"] || null,
        pfp:
          neighbor.pfp ||
          (slackNeighborFields["Pfp"] &&
            Array.isArray(slackNeighborFields["Pfp"]) &&
            slackNeighborFields["Pfp"][0]?.url) ||
          null,
        slackId: neighbor.slackId || slackNeighborFields["Slack ID"] || null,
        email: neighbor.email || null,
        userId,
      };
      if (slackData.slackId) {
        try {
          const web = new WebClient(process.env.SLACK_BOT_TOKEN);
          const result = await web.users.info({ user: slackData.slackId });
          if (result.ok && result.user) {
            slackData = {
              slackHandle: result.user.profile.display_name || result.user.name,
              fullName: result.user.real_name,
              pfp: result.user.profile.image_72,
              slackId: result.user.id,
              email: neighbor.email || null,
              userId,
            };
          }
        } catch (err) {
          // If Slack fetch fails, just return neighbor info
        }
      }
      return res.status(200).json(slackData);
    } catch (error) {
      console.error("Error fetching Slack user by token:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch Slack user information by token" });
    }
  }

  // Fallback: original logic using slackId
  if (!slackId) {
    return res.status(400).json({ error: "Slack ID is required" });
  }

  try {
    // Initialize the Slack WebClient with the bot token
    const web = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Get user info from Slack API
    const result = await web.users.info({
      user: slackId,
    });

    if (!result.ok) {
      throw new Error("Failed to fetch user info from Slack");
    }

    const user = result.user;

    // Return the relevant user information
    return res.status(200).json({
      slackHandle: user.profile.display_name || user.name,
      fullName: user.real_name,
      pfp: user.profile.image_72,
      slackId: user.id,
    });
  } catch (error) {
    console.error("Error fetching Slack user:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch Slack user information" });
  }
}
