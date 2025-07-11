import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, commitMessage, videoUrl, projectName, appId, session } =
    req.body;

  if (
    !token ||
    !commitMessage ||
    !videoUrl ||
    !projectName ||
    !appId ||
    !session
  ) {
    console.log("Missing required parameters:", {
      token,
      commitMessage,
      videoUrl,
      projectName,
      appId,
      session,
    });
    return res.status(400).json({ message: "Missing required parameters" });
  }

  // check token is valid with a regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!tokenRegex.test(token)) {
    console.log("Invalid token format:", token);
    return res.status(400).json({ message: "Invalid token format" });
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

    // Verify the app exists
    try {
      const app = await base("Apps").find(appId);
      console.log("Found app:", app.id, "with name:", app.fields.Name);
    } catch (error) {
      console.error("App not found:", appId);
      return res.status(404).json({ message: "App not found" });
    }

    const commitFields = {
      message: commitMessage,
      videoLink: videoUrl,
      commitTime: new Date().toISOString(),
      sessions: [session],
      neighbor: [userRecord.id],
      Apps: [appId],
      Type: "P", // Set as Pending by default
    };

    console.log(
      "Creating commit with fields:",
      JSON.stringify(commitFields, null, 2),
    );
    console.log("App ID being used:", appId);

    const commitRecord = await base("commits").create(
      [
        {
          fields: commitFields,
        },
      ],
      { typecast: true },
    );

    console.log(
      "Commit created in Airtable. Response:",
      JSON.stringify(
        {
          id: commitRecord[0].id,
          fields: commitRecord[0].fields,
        },
        null,
        2,
      ),
    );
    return res.status(201).json(commitRecord);
  } catch (error) {
    console.error("Error creating commit:", error);
    return res
      .status(500)
      .json({ message: error.message || "Internal server error" });
  }
}
