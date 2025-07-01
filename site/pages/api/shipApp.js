import Airtable from "airtable";

// Configure Next.js API to accept larger payloads for screenshots
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Increased size limit to handle larger images
    },
  },
};

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB in bytes

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    token,
    appId,
    codeUrl,
    playableUrl,
    howDidYouHear,
    whatAreWeDoingWell,
    howCanWeImprove,
    firstName,
    lastName,
    email,
    screenshots,
    description,
    githubUsername,
    addressLine1,
    addressLine2,
    city,
    stateProvince,
    country,
    zipCode,
    birthday,
  } = req.body;

  // Sanitize the token
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res
      .status(400)
      .json({ message: "Invalid token format", error: "INVALID_TOKEN" });
  }

  if (!token || !appId) {
    return res.status(401).json({ message: "Token and appId are required" });
  }

  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
    return res.status(400).json({
      message: "At least one screenshot is required",
      error: "SCREENSHOT_REQUIRED",
    });
  }

  try {
    // First, find the user by token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if any screenshot is too large
    let totalSize = 0;
    for (const screenshot of screenshots) {
      // Estimate base64 size
      const base64Size = (screenshot.length * 3) / 4;
      totalSize += base64Size;

      if (base64Size > MAX_ATTACHMENT_SIZE) {
        return res.status(400).json({
          message:
            "One or more screenshots are too large. Please reduce their size and try again.",
          error: "SCREENSHOT_TOO_LARGE",
        });
      }
    }

    // Get all submissions and find if this app has already been shipped
    console.log("Checking for existing submission for appId:", appId);
    const allSubmissions = await base("YSWS Project Submission")
      .select({
        filterByFormula: "NOT({app} = BLANK())",
        maxRecords: 100,
      })
      .firstPage();

    // Find the submission where the Apps array contains our appId
    const existingSubmission = allSubmissions.find((sub) => {
      const apps = sub.fields.App;
      console.log(
        "Checking submission App:",
        apps,
        "Type:",
        typeof apps,
        "Is Array:",
        Array.isArray(apps),
      );
      return Array.isArray(apps) && apps.includes(appId);
    });

    console.log("Existing submission found:", existingSubmission?.id);

    // Find if a submission exists with the same Email and Code URL
    const duplicateSubmissions = await base("YSWS Project Submission")
      .select({
        filterByFormula: `AND({Email} = '${email}', {Code URL} = '${codeUrl}')`,
        maxRecords: 1,
      })
      .firstPage();

    const submissionFields = {
      "Code URL": codeUrl,
      "Playable URL": playableUrl,
      "How did you hear about this?": howDidYouHear,
      "What are we doing well?": whatAreWeDoingWell,
      "How can we improve?": howCanWeImprove,
      "First Name": firstName,
      "Last Name": lastName,
      Email: email,
      Screenshot: screenshots.map((url) => ({ url })), // Airtable expects an array of objects with url property
      Description: description,
      "GitHub Username": githubUsername,
      "Address (Line 1)": addressLine1,
      "Address (Line 2)": addressLine2 || "",
      City: city,
      "State / Province": stateProvince,
      Country: country,
      "ZIP / Postal Code": zipCode,
      Birthday: birthday,
      app: [appId], // Link to the app record
    };

    // Create a separate fields object for ShipLog that includes changesMade
    const shipLogFields = {
      ...submissionFields,
      changesMade: req.body.changesMade || "",
    };

    let record;
    if (duplicateSubmissions.length > 0) {
      // Update the duplicate record
      const duplicate = duplicateSubmissions[0];
      console.log(
        "Updating duplicate submission (same Email and Code URL):",
        duplicate.id,
      );
      record = await base("YSWS Project Submission").update([
        {
          id: duplicate.id,
          fields: submissionFields,
        },
      ]);

      // Always add a new ShipLog record with changesMade
      await base("ShipLog").create([
        {
          fields: shipLogFields,
        },
      ]);
    } else if (existingSubmission) {
      // Update existing submission (by appId logic)
      console.log("Updating existing submission:", existingSubmission.id);
      record = await base("YSWS Project Submission").update([
        {
          id: existingSubmission.id,
          fields: submissionFields,
        },
      ]);

      // Always add a new ShipLog record with changesMade
      await base("ShipLog").create([
        {
          fields: shipLogFields,
        },
      ]);
    } else {
      // Create new submission
      console.log("Creating new submission for appId:", appId);
      record = await base("YSWS Project Submission").create([
        { fields: submissionFields },
      ]);

      // Always add a new ShipLog record with changesMade
      await base("ShipLog").create([
        {
          fields: shipLogFields,
        },
      ]);
    }

    // Return both the record and whether it was an update
    return res.status(200).json({
      message: "App shipped successfully",
      record: record[0],
      wasUpdate: !!existingSubmission,
    });
  } catch (error) {
    console.error("Error shipping app:", error);
    return res.status(500).json({
      message: "Error shipping app",
      error: error.message,
    });
  }
}
