import Airtable from "airtable";
import { cleanString } from "../../lib/airtable.js";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { appId } = req.body;

  if (!appId) {
    return res.status(400).json({ message: "App ID is required" });
  }

  const cleanedAppId = cleanString(appId);
  
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!cleanedAppId || !recordIdRegex.test(cleanedAppId)) {
    return res.status(400).json({ message: "Invalid or missing app ID" });
  }

  try {
    // Fetch the app record
    const appRecords = await base("Apps")
      .select({
        filterByFormula: `RECORD_ID() = '${cleanedAppId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (appRecords.length === 0) {
      return res.status(404).json({ message: "App not found" });
    }

    const app = appRecords[0];
    const currentJoinableStatus = app.fields.is_joinable || false;

    // Update the is_joinable field
    await base("Apps").update(app.id, {
      is_joinable: !currentJoinableStatus,
    });

    return res.status(200).json({
      message: `App joinable status toggled successfully`,
      appId: app.id,
      is_joinable: !currentJoinableStatus,
    });
  } catch (error) {
    console.error("Error toggling app joinable status:", error);
    return res
      .status(500)
      .json({
        message: "Error toggling app joinable status",
        error: error.message,
      });
  }
}
