import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

// Configure Next.js API to accept larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Increased size limit to handle larger images
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { icon, appId } = req.body;

  // Sanitize appId with a regex to ensure it matches Airtable's record ID format
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!recordIdRegex.test(appId)) {
    return res.status(400).json({ message: "Invalid app ID format" });
  }

  if (!icon || !appId) {
    return res
      .status(400)
      .json({ message: "Icon data and app ID are required" });
  }

  try {
    console.log("==== DEBUG: TEST ICON UPLOAD STARTING ====");
    console.log("App ID:", appId);
    console.log("Icon type:", typeof icon);

    // Handle placeholder option
    let isPlaceholder = false;
    if (icon === "placeholder") {
      console.log("Using placeholder image instead of uploaded file");
      isPlaceholder = true;
    } else {
      console.log("Icon length:", icon ? icon.length : 0);
      // Don't log actual icon content to avoid flooding the console
      console.log(
        "Icon format:",
        icon ? icon.substring(0, 30) + "..." : "No icon",
      );
    }

    // Get the app to use for testing
    console.log("Fetching app from Airtable...");
    const appRecords = await base("Apps")
      .select({
        filterByFormula: `RECORD_ID() = '${appId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (appRecords.length === 0) {
      console.log("App not found for ID:", appId);
      return res.status(404).json({ message: "App not found" });
    }

    console.log("App found. Name:", appRecords[0].fields.Name);
    console.log("Current app fields:", Object.keys(appRecords[0].fields));

    // First, clear any existing icon
    console.log("Clearing existing icon...");
    await base("Apps").update([
      {
        id: appId,
        fields: { Icon: null },
      },
    ]);

    console.log("Icon cleared successfully, preparing to upload new icon");

    // Handle icon upload tests based on what we've learned
    if (isPlaceholder) {
      console.log("Using placeholder image");
      const placeholderUrl = "https://via.placeholder.com/100";

      try {
        // Use the correct URL-based format that Airtable accepts
        await base("Apps").update([
          {
            id: appId,
            fields: {
              Icon: [{ url: placeholderUrl }],
            },
          },
        ]);

        console.log("Placeholder image upload succeeded!");
        return res.status(200).json({
          message: "Successfully uploaded placeholder icon",
          iconUrl: placeholderUrl,
        });
      } catch (error) {
        console.error("Error uploading placeholder image:", error);
        return res.status(500).json({
          message: "Failed to upload placeholder icon",
          error: error.message,
        });
      }
    }
    // Handle URL-based icon
    else if (icon.startsWith("http://") || icon.startsWith("https://")) {
      console.log("Using direct URL for icon");
      try {
        await base("Apps").update([
          {
            id: appId,
            fields: {
              Icon: [{ url: icon }],
            },
          },
        ]);

        console.log("URL-based icon upload succeeded!");
        return res.status(200).json({
          message: "Successfully uploaded icon using URL",
          iconUrl: icon,
        });
      } catch (error) {
        console.error("Error uploading URL-based icon:", error);
        return res.status(500).json({
          message: "Failed to upload URL-based icon",
          error: error.message,
        });
      }
    }
    // For data URLs, inform user that Airtable doesn't support direct uploads
    else if (icon.startsWith("data:")) {
      console.log(
        "Data URL detected - Airtable doesn't support direct uploads",
      );
      const placeholderUrl = "https://via.placeholder.com/100";

      try {
        await base("Apps").update([
          {
            id: appId,
            fields: {
              Icon: [{ url: placeholderUrl }],
            },
          },
        ]);

        console.log("Used placeholder instead of data URL");
        return res.status(200).json({
          message:
            "Airtable doesn't support direct base64 uploads. Used placeholder instead.",
          iconUrl: placeholderUrl,
          warning:
            "To use your own icon, please provide a URL to a hosted image",
        });
      } catch (error) {
        console.error("Error using placeholder for data URL:", error);
        return res.status(500).json({
          message: "Failed to upload placeholder for data URL",
          error: error.message,
        });
      }
    } else {
      console.error("Invalid icon format - must be a URL or data URL");
      return res.status(400).json({
        message: "Invalid icon format - must be a URL or data URL",
      });
    }
  } catch (error) {
    console.error("==== DEBUG: TEST ICON UPLOAD FAILED ====");
    console.error("Error in test icon upload:", error);
    console.error("Error message:", error.message);
    console.error("Error name:", error.name);
    console.error("Status code:", error.statusCode);

    if (error.stack) {
      // Don't print full stack to avoid flooding console
      console.error(
        "Stack trace (first 3 lines):",
        error.stack.split("\n").slice(0, 3).join("\n"),
      );
    }

    return res.status(500).json({
      message: "Failed to upload test icon",
      error: error.message,
      statusCode: error.statusCode,
      stack: error.stack
        ? error.stack.split("\n").slice(0, 3).join("\n")
        : null,
    });
  }
}
