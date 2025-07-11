import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { appId } = req.query;

  // Validate appId with regex to ensure it matches Airtable's record ID format
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!appId || !recordIdRegex.test(appId)) {
    return res.status(400).json({ message: "Invalid or missing app ID" });
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
    const isJoinable = app.fields.is_joinable || false;

    return res.status(200).json({
      message: "App joinable status retrieved successfully",
      appId: app.id,
      is_joinable: isJoinable,
    });
  } catch (error) {
    console.error("Error retrieving app joinable status:", error);
    return res
      .status(500)
      .json({
        message: "Error retrieving app joinable status",
        error: error.message,
      });
  }
}
