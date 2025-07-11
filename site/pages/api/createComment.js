import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

// Validation regex patterns
const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
const contentRegex = /^[\s\S]{1,3000}$/; // Allow any characters but limit length

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { content, postId, neighborToken } = req.body;

  // Log received values to help with debugging
  console.log("Received values:", { content, postId, neighborToken });

  if (!content || !postId || !neighborToken) {
    return res.status(400).json({
      message: "Missing required fields",
      received: {
        content: !!content,
        postId: !!postId,
        neighborToken: !!neighborToken,
      },
    });
  }

  // Validate content format and length
  if (!contentRegex.test(content)) {
    return res.status(400).json({
      message: "Invalid content format or length (max 3000 characters)",
    });
  }

  // Validate postId format
  if (!recordIdRegex.test(postId)) {
    return res.status(400).json({
      message: "Invalid post ID format",
    });
  }

  // Validate token format
  if (!tokenRegex.test(neighborToken)) {
    return res.status(400).json({
      message: "Invalid token format",
    });
  }

  try {
    // Look up neighbor record by token - escape single quotes to prevent formula injection
    let neighborId = neighborToken;
    try {
      const safeToken = neighborToken.replace(/'/g, "\\'");
      const neighborRecords = await base("neighbors")
        .select({ filterByFormula: `{token} = '${safeToken}'`, maxRecords: 1 })
        .firstPage();
      if (neighborRecords.length > 0) {
        neighborId = neighborRecords[0].id;
      }
    } catch (e) {
      console.error("Error finding neighbor by token:", e);
      // fallback: just use the token if lookup fails
    }

    // Create the comment with the current timestamp
    const now = new Date();
    // Sanitize content before storing
    const sanitizedContent = content.trim().substring(0, 3000);
    const newRecord = await base("Comments").create([
      {
        fields: {
          content: sanitizedContent,
          post: [postId], // Ensure this is always an array
          sentFrom: [neighborId], // Also ensure this is an array for linked records
        },
      },
    ]);

    console.log("Comment created:", newRecord[0].id);

    return res.status(200).json({
      message: "Comment posted successfully",
      record: newRecord[0],
    });
  } catch (error) {
    console.error("Error posting comment:", error);
    console.error("Detailed error info:", {
      message: error.message,
      stack: error.stack,
      airtableError: error.error || error.data || null,
    });
    return res.status(500).json({
      message: "Error posting comment",
    });
  }
}
