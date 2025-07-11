import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

async function createMoleCheck(appLink, githubUrl) {
  try {
    console.log("Attempting to create mole check with:", {
      appLink,
      githubUrl,
    });

    const response = await fetch(
      "https://adventure-time.hackclub.dev/api/moleCreate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          appLink,
          githubUrl,
        }),
      },
    );

    console.log("Mole check response status:", response.status);
    console.log("Mole check response headers:", response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("Mole check error response:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("Mole check successful response:", data);
    return data;
  } catch (error) {
    console.log("Error creating mole check:", error);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { demoVideo, photoboothVideo, description, neighbor, app } = req.body;

  // Check app name and token with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!neighbor || !tokenRegex.test(neighbor)) {
    return res
      .status(400)
      .json({ message: "Invalid or missing neighbor token" });
  }

  const descriptionRegex = /^[\s\S]{1,1000}$/;
  const videoUrlRegex =
    /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
  if (
    !description ||
    !descriptionRegex.test(description) ||
    !demoVideo ||
    !videoUrlRegex.test(demoVideo) ||
    !photoboothVideo ||
    !videoUrlRegex.test(photoboothVideo)
  ) {
    return res.status(400).json({
      message:
        "Invalid or missing fields: demoVideo, photoboothVideo, description",
    });
  }

  if (!demoVideo || !photoboothVideo || !description || !neighbor || !app) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const escapedAppName = app.replaceAll("'", "''")

  try {
    // Look up neighbor record by token to get their email
    let neighborId = neighbor;
    try {
      const neighborRecords = await base("neighbors")
        .select({ filterByFormula: `{token} = '${neighbor}'`, maxRecords: 1 })
        .firstPage();
      if (neighborRecords.length > 0) {
        neighborId = neighborRecords[0].id;
      }
    } catch (e) {
      // fallback: just use the token if lookup fails
    }

    // Look up app record by name to get its id and links
    let appId = escapedAppName;
    let appLink = null;
    let githubUrl = null;
    try {
      const appRecords = await base("Apps")
        .select({ filterByFormula: `{Name} = '${escapedAppName}'`, maxRecords: 1 })
        .firstPage();
      if (appRecords.length > 0) {
        appId = appRecords[0].id;
        appLink = appRecords[0].fields["App Link"] || null;
        githubUrl = appRecords[0].fields["Github Link"] || null;
      }
    } catch (e) {
      // fallback: just use the name if lookup fails
    }

    console.log("neighborId:", neighborId);
    console.log("appId:", appId);
    console.log("appLink:", appLink);
    console.log("githubUrl:", githubUrl);

    // Fetch all posts and filter in JS
    let lastPostDate = "2025-04-29T00:00:00.000Z";
    try {
      const allPosts = await base("Posts")
        .select({
          maxRecords: 10000,
          sort: [{ field: "createdAt", direction: "desc" }],
        })
        .all();

      const userPosts = allPosts.filter(
        (post) =>
          Array.isArray(post.fields.neighbor) &&
          post.fields.neighbor.includes(neighborId),
      );

      if (userPosts.length > 0) {
        lastPostDate = userPosts[0]._rawJson.createdTime;
        console.log("lastPostDate from previous post:", lastPostDate);
      } else {
        console.log(
          "No previous posts found, using default lastPostDate:",
          lastPostDate,
        );
      }
    } catch (e) {
      console.log("Error fetching previous posts:", e);
    }

    console.log("Final lastPostDate to be set:", lastPostDate);

    // Now create the post
    const newRecord = await base("Posts").create([
      {
        fields: {
          demoVideo,
          photoboothVideo,
          description,
          neighbor: [neighborId],
          app: [appId],
          lastPost: lastPostDate,
        },
      },
    ]);

    // Create mole check if we have both appLink and githubUrl from the app record
    let moleCheckResult = null;
    if (appLink && githubUrl) {
      moleCheckResult = await createMoleCheck(appLink, githubUrl);
    }

    return res.status(200).json({
      message: "Devlog posted successfully",
      record: newRecord[0],
    });
  } catch (error) {
    console.error("Error posting devlog:", error);
    return res.status(500).json({
      message: "Error posting devlog",
      error: error.message,
      stack: error.stack,
      airtableError: error.error || error.data || null,
    });
  }
}
