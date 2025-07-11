import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, projectName, appId, startTime, endTime, videoUrl } = req.body;

  // Validate required fields with regex (only those used by filterByFormula)
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  const urlRegex =
    /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }
  if (
    !projectName ||
    typeof projectName !== "string" ||
    projectName.length > 100
  ) {
    return res.status(400).json({ message: "Invalid or missing project name" });
  }
  if (!appId || !recordIdRegex.test(appId)) {
    return res.status(400).json({ message: "Invalid or missing app ID" });
  }

  if (!token || !startTime || !endTime) {
    console.log("Missing required fields:", { token, startTime, endTime });
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const userRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRecord = userRecords[0];
    console.log("Found user:", userRecord.id);

    const sessionRecords = await base("sessions").create(
      [
        {
          fields: {
            neighbor: [userRecord.id],
            startTime: startTime,
            endTime: endTime,
          },
        },
      ],
      { typecast: true },
    );

    console.log("Session created:", sessionRecords);
    return res.status(201).json(sessionRecords);
  } catch (error) {
    console.error("Error creating session:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal server error" });
  }
}
