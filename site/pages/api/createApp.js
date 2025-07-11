import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

// Validation regex patterns
const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
const nameRegex = /^[\w\s\-().,:;?!'"&+]{1,100}$/;
const urlRegex =
  /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

// Configure Next.js API to accept larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Increased size limit to handle larger images
    },
  },
};

// Max size for icon in bytes
const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    token,
    name,
    icon,
    appLink,
    githubLink,
    description,
    images,
    hackatimeProjects,
    hackatimeProjectGithubLinks,
  } = req.body;

  // Validate input parameters
  if (!tokenRegex.test(token)) {
    console.log("Invalid token format");
    return res.status(400).json({ message: "Invalid token format" });
  }

  if (name && !nameRegex.test(name)) {
    console.log("Invalid name format");
    return res.status(400).json({ message: "Invalid app name format" });
  }

  if (appLink && !urlRegex.test(appLink)) {
    console.log("Invalid app link format");
    return res.status(400).json({ message: "Invalid app link format" });
  }

  if (githubLink && !urlRegex.test(githubLink)) {
    console.log("Invalid GitHub link format");
    return res.status(400).json({ message: "Invalid GitHub link format" });
  }

  // Validate hackatimeProjects if provided
  if (hackatimeProjects && !Array.isArray(hackatimeProjects)) {
    console.log("hackatimeProjects must be an array");
    return res
      .status(400)
      .json({ message: "hackatimeProjects must be an array" });
  }

  // Validate images if provided
  if (images && !Array.isArray(images)) {
    console.log("images must be an array");
    return res.status(400).json({ message: "images must be an array" });
  }

  // Debug request
  console.log("==== DEBUG: CREATE APP REQUEST ====");
  console.log("App Name:", name);
  console.log("Icon provided:", !!icon);
  if (icon) {
    console.log("Icon type:", typeof icon);
    console.log("Icon length:", icon.length);
    // Limit icon preview to avoid flooding console
    console.log("Icon format:", icon.substring(0, 30) + "...");
  }

  if (!token || !name) {
    console.log("Missing required fields:", {
      hasToken: !!token,
      hasName: !!name,
    });
    return res.status(400).json({ message: "Token and app name are required" });
  }

  try {
    // Get user data from token
    console.log("Fetching user data from token");
    const safeToken = token.replace(/'/g, "\\'"); // Escape single quotes to prevent formula injection
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${safeToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      console.log("No user found with this token");
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRecords[0].id;
    console.log("User found with ID:", userId);

    // If hackatimeProjects are provided, check and process them first
    let hackatimeProjectIds = [];
    if (hackatimeProjects && hackatimeProjects.length > 0) {
      console.log("Processing Hackatime projects:", hackatimeProjects);

      // First, get all existing projects with these names
      // Escape project names to prevent formula injection
      const safeProjectNames = hackatimeProjects.map(
        (name) => `{name} = '${name.replace(/'/g, "\\'")}'`,
      );
      const existingProjects = await base("hackatimeProjects")
        .select({
          filterByFormula: `OR(${safeProjectNames.join(",")})`,
        })
        .all();

      console.log(
        "Found existing projects:",
        existingProjects.map((p) => ({
          name: p.fields.name,
          id: p.id,
          neighbors: p.fields.neighbor || [],
          apps: p.fields.Apps || [],
        })),
      );

      // Create a map of existing projects by name
      const existingProjectsByName = new Map();
      existingProjects.forEach((p) => {
        if (!existingProjectsByName.has(p.fields.name)) {
          existingProjectsByName.set(p.fields.name, []);
        }
        existingProjectsByName.get(p.fields.name).push(p);
      });

      // For each project name
      for (const projectName of hackatimeProjects) {
        const existingProjectsForName =
          existingProjectsByName.get(projectName) || [];

        // Find if user already has a project with this name
        const userProject = existingProjectsForName.find((p) =>
          (p.fields.neighbor || []).includes(userId),
        );

        if (userProject) {
          // If user already has a project with this name, use it
          hackatimeProjectIds.push(userProject.id);
          console.log(
            `Using existing project for ${projectName}:`,
            userProject.id,
          );

          // Update GitHub link if provided
          if (hackatimeProjectGithubLinks?.[projectName]) {
            const gitLink = hackatimeProjectGithubLinks[projectName];
            // Validate GitHub link format
            if (gitLink && urlRegex.test(gitLink)) {
              await base("hackatimeProjects").update(userProject.id, {
                githubLink: gitLink,
              });
            } else {
              console.log(
                `Invalid GitHub link for project ${projectName}, skipping update`,
              );
            }
          }
        } else {
          // Create new project for this user
          console.log(`Creating new project for ${projectName}`);
          try {
            // Validate and sanitize GitHub link if provided
            let gitLink = "";
            if (hackatimeProjectGithubLinks?.[projectName]) {
              gitLink = urlRegex.test(hackatimeProjectGithubLinks[projectName])
                ? hackatimeProjectGithubLinks[projectName]
                : "";
            }

            const newProject = await base("hackatimeProjects").create({
              name: projectName,
              neighbor: [userId],
              githubLink: gitLink,
            });
            hackatimeProjectIds.push(newProject.id);
            console.log(
              `Created new project ${projectName} with ID:`,
              newProject.id,
            );
          } catch (error) {
            console.error(`Failed to create project ${projectName}:`, error);
            throw error;
          }
        }
      }
    }

    // Create app fields without image data - sanitize inputs
    const sanitizedDescription = description
      ? description.substring(0, 1000)
      : ""; // Limit description length

    const appFields = {
      Name: name,
      "App Link": appLink || "",
      "Github Link": githubLink || "",
      Description: sanitizedDescription,
      Neighbors: [userId],
      hackatimeProjects: hackatimeProjectIds,
    };
    console.log("Prepared app fields:", Object.keys(appFields));

    // Handle icon URL
    if (icon && typeof icon === "string") {
      console.log("Processing icon data");

      if (icon.startsWith("http://") || icon.startsWith("https://")) {
        console.log(
          "Using direct URL for icon:",
          icon.substring(0, 50) + "...",
        );
        appFields.Icon = icon;
        console.log("Set icon URL as text");
      } else {
        console.log("Invalid icon format - must be a URL");
        // Don't set invalid icon URLs
      }
    }

    // Handle images as comma-separated URLs
    if (images && Array.isArray(images)) {
      console.log("Processing images:", images.length);
      // Filter out any non-URL values and join with commas
      const validUrls = images.filter(
        (url) =>
          typeof url === "string" &&
          (url.startsWith("http://") || url.startsWith("https://")) &&
          urlRegex.test(url),
      );
      if (validUrls.length > 0) {
        // Limit the number of images to prevent excessively large entries
        const limitedUrls = validUrls.slice(0, 10);
        appFields.Images = limitedUrls.join(",");
        console.log("Set images as comma-separated URLs, limited to 10 images");
      }
    }

    // Create new app record in Apps table
    console.log("Creating app in Airtable...");
    let newApp;
    try {
      newApp = await base("Apps").create([
        {
          fields: appFields,
        },
      ]);
      console.log("App created successfully with ID:", newApp[0].id);
    } catch (createError) {
      console.error("Error creating app in Airtable:", createError);
      console.error("Error details:", {
        message: createError.message,
        statusCode: createError.statusCode,
      });

      // If the error is related to icon attachment, try again without the icon
      if (createError.message && createError.message.includes("Icon")) {
        console.log("Trying without icon");
        // Remove icon from fields and try again
        delete appFields.Icon;

        newApp = await base("Apps").create([
          {
            fields: appFields,
          },
        ]);
        console.log("App created without icon");
      } else {
        // If it's not an icon issue, rethrow the error
        throw createError;
      }
    }

    // Get the full app details to return to client
    console.log("Fetching complete app details");
    const createdApp = await base("Apps").find(newApp[0].id);

    console.log("Has Icon after creation?", !!createdApp.fields.Icon);
    if (createdApp.fields.Icon) {
      console.log(
        "Icon details after creation:",
        JSON.stringify(createdApp.fields.Icon),
      );
    }

    return res.status(201).json({
      message: "App created successfully",
      app: {
        id: createdApp.id,
        name: createdApp.fields.Name || "",
        icon: createdApp.fields.Icon || null,
        appLink: createdApp.fields["App Link"] || "",
        githubLink: createdApp.fields["Github Link"] || "",
        description: createdApp.fields.Description || "",
        createdAt: createdApp.fields.createdAt || null,
        images: createdApp.fields.Images
          ? createdApp.fields.Images.split(",")
          : [],
        hackatimeProjects: createdApp.fields.hackatimeProjects || [],
      },
    });
  } catch (error) {
    console.error("==== DEBUG: CREATE APP ERROR ====");
    console.error("Error creating app:", error);
    console.error("Error message:", error.message);
    console.error("Error name:", error.name);
    console.error("Status code:", error.statusCode);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return res.status(500).json({
      message: "Failed to create app",
      error: error.message,
      statusCode: error.statusCode,
    });
  }
}
