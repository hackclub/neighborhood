import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

async function getRecordName(table, id, field = "Name") {
  if (!id) return null;
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
    return id;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id } = req.query;

  // check if id is a valid Airtable record ID with regex
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!recordIdRegex.test(id)) {
    return res.status(400).json({ message: "Invalid post ID format" });
  }

  if (!id) {
    return res.status(400).json({ message: "Post ID is required" });
  }

  try {
    const record = await base("Posts").find(id);

    // Get app and neighbor names
    const appId = record.fields.app;
    const neighborId = record.fields.neighbor;

    // Fetch app and neighbor names in parallel
    const [appName, neighborName] = await Promise.all([
      appId ? getRecordName("Apps", appId) : null,
      neighborId ? getRecordName("neighbors", neighborId) : null,
    ]);

    // Fetch comments
    let comments = [];
    if (
      record.fields.Comments &&
      Array.isArray(record.fields.Comments) &&
      record.fields.Comments.length > 0
    ) {
      try {
        comments = await Promise.all(
          record.fields.Comments.map(async (commentId) => {
            try {
              const comment = await base("Comments").find(commentId);

              let commenterInfo = null;
              const senderIds = comment.fields.sentFrom;
              if (
                senderIds &&
                Array.isArray(senderIds) &&
                senderIds.length > 0
              ) {
                try {
                  const sender = await base("neighbors").find(senderIds[0]);

                  const getFirst = (value) => {
                    if (Array.isArray(value)) return value[0];
                    return value;
                  };

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
                      getFirst(sender.fields["Full Name (from slackNeighbor)"]),
                    profilePicture: profilePic,
                    handle:
                      getFirst(sender.fields.handle) ||
                      getFirst(
                        sender.fields["Slack Handle (from slackNeighbor)"],
                      ),
                    fullName:
                      getFirst(sender.fields["Full Name"]) ||
                      getFirst(sender.fields["Full Name (from slackNeighbor)"]),
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

        comments = comments.filter(Boolean);
      } catch (error) {
        console.error("Error fetching comments for post:", error);
      }
    }

    const post = {
      airtableId: record.id,
      ...record.fields,
      app: appName,
      neighbor: neighborName,
      comments,
    };

    return res.status(200).json({ post });
  } catch (error) {
    console.error("Error fetching post:", error);
    return res.status(500).json({
      message: "Error fetching post",
      error: error.message,
    });
  }
}
