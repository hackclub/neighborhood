import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

// Validation regex patterns
const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;

async function getRecordName(table, id, field = "Name") {
  if (!id) return null;

  // Validate record ID format to prevent injection
  if (!recordIdRegex.test(id)) {
    console.error(`Invalid record ID format: ${id}`);
    return "Unknown";
  }

  try {
    const rec = await base(table).find(id);
    if (table === "neighbors") {
      // Try Full Name, then email, then Name
      return (
        rec.fields["Full Name"] ||
        rec.fields["Slack Handle (from slackNeighbor)"] ||
        rec.fields["Full Name (from slackNeighbor)"]
      );
    }
    return (
      rec.fields["Full Name"] ||
      rec.fields["Slack Handle (from slackNeighbor)"] ||
      rec.fields["Full Name (from slackNeighbor)"]
    );
  } catch (e) {
    console.error(`Failed to fetch ${table} record for id ${id}:`, e.message);
    return "Unknown";
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
        maxRecords: 100,
      })
      .all();

    // Log the first record to see its structure
    if (records.length > 0) {
      console.log("First record structure:");
      console.log("record.id:", records[0].id);
      console.log("record.fields:", Object.keys(records[0].fields));
      console.log("record properties:", Object.keys(records[0]));
      // Check for an airtableId property
      if (records[0].airtableId) {
        console.log("record.airtableId:", records[0].airtableId);
      } else {
        console.log("No airtableId property directly on record");
      }
      if (records[0].fields.airtableId) {
        console.log("record.fields.airtableId:", records[0].fields.airtableId);
      } else {
        console.log("No airtableId in record.fields");
      }
    }

    // Collect all unique app and neighbor IDs
    const appIds = new Set();
    const neighborIds = new Set();
    records.forEach((record) => {
      const appField = record.fields.app;
      const neighborField = record.fields.neighbor;
      if (Array.isArray(appField)) {
        appField.forEach((id) => {
          // Validate ID format before adding
          if (recordIdRegex.test(id)) appIds.add(id);
        });
      } else if (appField && recordIdRegex.test(appField)) {
        appIds.add(appField);
      }
      if (Array.isArray(neighborField)) {
        neighborField.forEach((id) => {
          // Validate ID format before adding
          if (recordIdRegex.test(id)) neighborIds.add(id);
        });
      } else if (neighborField && recordIdRegex.test(neighborField)) {
        neighborIds.add(neighborField);
      }
    });

    // Fetch all apps and neighbors in parallel
    const [apps, neighbors] = await Promise.all([
      Promise.all(
        Array.from(appIds).map((id) => getRecordName("Apps", id, "Name")),
      ),
      Promise.all(
        Array.from(neighborIds).map((id) => getRecordName("neighbors", id)),
      ),
    ]);
    const appIdToName = {};
    Array.from(appIds).forEach((id, i) => {
      appIdToName[id] = apps[i];
    });
    const neighborIdToName = {};
    Array.from(neighborIds).forEach((id, i) => {
      neighborIdToName[id] = neighbors[i];
    });

    const posts = await Promise.all(
      records.map(async (record) => {
        const fields = { ...record.fields };
        // Replace app and neighbor fields with names
        if (fields.app) {
          if (Array.isArray(fields.app)) {
            fields.app = fields.app
              .map((id) => appIdToName[id] || id)
              .join(", ");
          } else {
            fields.app = appIdToName[fields.app] || fields.app;
          }
        }
        if (fields.neighbor) {
          if (Array.isArray(fields.neighbor)) {
            fields.neighbor = fields.neighbor
              .map((id) => neighborIdToName[id] || id)
              .join(", ");
          } else {
            fields.neighbor =
              neighborIdToName[fields.neighbor] || fields.neighbor;
          }
        }

        // Directly fetch comments for this post using Airtable find
        let comments = [];
        // Limit the number of comments to prevent excessive queries
        const MAX_COMMENTS = 50;
        if (
          fields.Comments &&
          Array.isArray(fields.Comments) &&
          fields.Comments.length > 0
        ) {
          // Limit comments to prevent excessive queries
          const limitedComments = fields.Comments.slice(0, MAX_COMMENTS);
          try {
            comments = await Promise.all(
              limitedComments.map(async (commentId) => {
                try {
                  // Get the comment record
                  // Validate comment ID format before querying
                  if (!recordIdRegex.test(commentId)) {
                    console.error(`Invalid comment ID format: ${commentId}`);
                    return null;
                  }
                  const comment = await base("Comments").find(commentId);

                  // Get the commenter's info
                  let commenterInfo = null;
                  const senderIds = comment.fields.sentFrom;
                  if (
                    senderIds &&
                    Array.isArray(senderIds) &&
                    senderIds.length > 0
                  ) {
                    try {
                      // Validate sender ID format before querying
                      const senderId = senderIds[0];
                      if (!recordIdRegex.test(senderId)) {
                        console.error(`Invalid sender ID format: ${senderId}`);
                        return null;
                      }
                      const sender = await base("neighbors").find(senderId);

                      // Helper function to extract first item from potential arrays
                      const getFirst = (value) => {
                        if (Array.isArray(value)) return value[0];
                        return value;
                      };

                      // Get profile picture URL directly
                      let profilePic = null;
                      if (sender.fields.profilePicture) {
                        const pic = getFirst(sender.fields.profilePicture);
                        profilePic =
                          typeof pic === "object" && pic.url ? pic.url : pic;
                      } else if (sender.fields.pfp) {
                        const pic = getFirst(sender.fields.pfp);
                        profilePic =
                          typeof pic === "object" && pic.url ? pic.url : pic;
                      } else if (comment.fields.pfp) {
                        const pic = getFirst(comment.fields.pfp);
                        profilePic =
                          typeof pic === "object" && pic.url ? pic.url : pic;
                      }

                      commenterInfo = {
                        name:
                          getFirst(sender.fields["Full Name"]) ||
                          getFirst(
                            sender.fields["Slack Handle (from slackNeighbor)"],
                          ) ||
                          getFirst(
                            sender.fields["Full Name (from slackNeighbor)"],
                          ),
                        profilePicture: profilePic,
                        handle:
                          getFirst(sender.fields.handle) ||
                          getFirst(
                            sender.fields["Slack Handle (from slackNeighbor)"],
                          ),
                        fullName:
                          getFirst(sender.fields["Full Name"]) ||
                          getFirst(
                            sender.fields["Full Name (from slackNeighbor)"],
                          ),
                      };
                    } catch (error) {
                      console.error("Error fetching commenter info:", error);
                    }
                  }

                  return {
                    commentMessage: comment.fields.content,
                    commentSender: commenterInfo,
                    createTime: comment.fields.createTime,
                  };
                } catch (error) {
                  console.error("Error fetching comment:", error);
                  return null;
                }
              }),
            );

            // Filter out null values (failed fetches)
            comments = comments.filter(Boolean);
          } catch (error) {
            console.error("Error fetching comments for post:", error);
          }
        }

        return {
          airtableId: record.id,
          ...fields,
          comments,
        };
      }),
    );

    return res.status(200).json({ posts });
  } catch (error) {
    console.error("Error fetching latest posts:", error);
    console.error("Detailed error information:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    return res.status(500).json({
      message: "Error fetching latest posts",
    });
  }
}
