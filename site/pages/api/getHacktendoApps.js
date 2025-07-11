import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

// Define URL regex pattern for validation
const urlRegex =
  /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get all apps that have isHacktendo checked
    const apps = await base("Apps")
      .select({
        fields: [
          "Name",
          "Icon",
          "App Link",
          "Images",
          "Description",
          "Neighbors",
          "createdAt",
          "isHacktendo",
          "YSWS Project Submission–Created At",
        ],
        filterByFormula:
          "AND({isHacktendo} = 1, NOT({YSWS Project Submission–Created At} = ''))",
      })
      .all();

    // Format the apps data
    const formattedApps = apps.map((app) => {
      // Handle icon URL - validate URL format
      let iconUrl = null;
      if (app.fields.Icon) {
        if (typeof app.fields.Icon === "string") {
          // Validate URL before using
          iconUrl = urlRegex.test(app.fields.Icon) ? app.fields.Icon : null;
        } else if (
          Array.isArray(app.fields.Icon) &&
          app.fields.Icon.length > 0
        ) {
          iconUrl = app.fields.Icon[0].url;
        }
      }

      // Handle images - validate URLs and limit number of images
      let images = [];
      if (app.fields.Images) {
        if (typeof app.fields.Images === "string") {
          // Validate URL before adding
          if (urlRegex.test(app.fields.Images)) {
            images = [app.fields.Images];
          }
        } else if (Array.isArray(app.fields.Images)) {
          // Limit number of images to 10 to prevent excessive data
          const limitedImages = app.fields.Images.slice(0, 10);
          images = limitedImages.map((img) => img.url);
        }
      }

      return {
        id: app.id,
        name: app.fields.Name || "Unnamed App",
        icon: iconUrl,
        appLink: urlRegex.test(app.fields["App Link"])
          ? app.fields["App Link"]
          : "",
        description: app.fields.Description
          ? app.fields.Description.substring(0, 1000)
          : "",
        createdAt: app.fields.createdAt || null,
        images: images,
        memberCount: (app.fields.Neighbors || []).length,
        hasImages: images.length > 0,
      };
    });

    // Sort apps: first by having images, then by member count
    const sortedApps = formattedApps.sort((a, b) => {
      // First sort by having images
      if (a.hasImages && !b.hasImages) return -1;
      if (!a.hasImages && b.hasImages) return 1;

      // Then sort by member count
      return b.memberCount - a.memberCount;
    });

    // Remove the hasImages property before sending response
    const finalApps = sortedApps.map(({ hasImages, ...app }) => app);

    return res.status(200).json({ apps: finalApps });
  } catch (error) {
    console.error("Error fetching Hacktendo apps:", error);
    console.error("Detailed error information:", {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    });
    // Don't expose detailed error messages to client
    return res.status(500).json({ message: "Error fetching Hacktendo apps" });
  }
}
