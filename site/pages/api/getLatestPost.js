import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

function sanitizeOutput(data) {
  if (typeof data === "string") {
    return data.replace(/[&<>"'`]/g, (match) => {
      const escapeMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "`": "&#x60;",
      };
      return escapeMap[match];
    });
  } else if (Array.isArray(data)) {
    return data.map(sanitizeOutput);
  } else if (typeof data === "object" && data !== null) {
    const sanitizedObject = {};
    for (const key in data) {
      sanitizedObject[key] = sanitizeOutput(data[key]);
    }
    return sanitizedObject;
  }
  return data;
}

async function getRecordName(table, id, field = "Name") {
  if (!id) return null;
  try {
    const rec = await base(table).find(id);
    const fieldValue =
      rec.fields["Full Name"] ||
      rec.fields["Slack Handle (from slackNeighbor)"] ||
      rec.fields["Full Name (from slackNeighbor)"];
    return sanitizeOutput(fieldValue || id);
  } catch (e) {
    console.error(`Failed to fetch ${table} record for id ${id}:`, e.message);
    return sanitizeOutput(id);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const records = await base("Posts")
      .select({
        sort: [{ field: "createdAt", direction: "desc" }],
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(200).json({ post: null });
    }

    const record = records[0];

    // Get app and neighbor names
    const appId = record.fields.app;
    const neighborId = record.fields.neighbor;

    // Fetch app and neighbor names in parallel
    const [appName, neighborName] = await Promise.all([
      appId ? getRecordName("Apps", appId) : null,
      neighborId ? getRecordName("neighbors", neighborId) : null,
    ]);

    // For the latest post, we'll skip fetching comments to make it faster
    const sanitizedFields = sanitizeOutput(record.fields);

    const post = {
      airtableId: sanitizeOutput(record.id),
      ...sanitizedFields,
      app: appName,
      neighbor: neighborName,
      comments: [], // Empty array for latest post view
    };

    return res.status(200).json({ post });
  } catch (error) {
    console.error("Error fetching latest post:", error);
    return res.status(500).json({
      message: "Error fetching latest post",
      error: sanitizeOutput(error.message),
    });
  }
}
