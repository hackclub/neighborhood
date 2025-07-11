import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { appId } = req.body;

  // Sanitize appid with a regex to ensure it matches Airtable's record ID format
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!recordIdRegex.test(appId)) {
    return res.status(400).json({ message: "Invalid app ID format" });
  }

  if (!appId) {
    return res.status(400).json({ message: "App ID is required" });
  }

  try {
    // Fetch the app record
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
