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

// Max size for icon in bytes
const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    token,
    appId,
    name,
    icon,
    appLink,
    githubLink,
    description,
    images,
    hackatimeProjects,
    hackatimeProjectGithubLinks,
  } = req.body;

  // Check if token & appId are valid with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  const recordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  // Debug request
  console.log("==== DEBUG: UPDATE APP REQUEST ====");
  console.log("App ID:", appId);
  console.log("App Name:", name);
  console.log("Icon provided:", !!icon);
  if (icon) {
    console.log("Icon type:", typeof icon);
    console.log("Icon length:", icon.length);
    // Limit icon preview to avoid flooding console
    console.log("Icon format:", icon.substring(0, 30) + "...");
  }

  if (!token || !appId || !name) {
    console.log("Missing required fields:", {
      hasToken: !!token,
      hasAppId: !!appId,
      hasName: !!name,
    });
    return res
      .status(400)
      .json({ message: "Token, app ID, and app name are required" });
  }

  try {
    // Get user data from token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userRecords[0].id;

    // Get the app to verify ownership
    const appRecords = await base("Apps")
      .select({
        filterByFormula: `RECORD_ID() = '${appId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (appRecords.length === 0) {
      return res.status(404).json({ message: "App not found" });
    }

    const currentNeighbors = appRecords[0].fields.Neighbors || [];

    // Check if user is a member of this app
    if (!currentNeighbors.includes(userId)) {
      return res
        .status(403)
        .json({ message: "You don't have permission to edit this app" });
    }

    // Fetch the current app data to handle attachments correctly
    const currentApp = appRecords[0];
    console.log("Current app found:", currentApp.id);
    console.log("Current app fields:", Object.keys(currentApp.fields));
    console.log(
      "Current icon:",
      currentApp.fields.Icon ? "Present" : "Not present",
    );

    // If hackatimeProjects are provided, fetch their record IDs
    let hackatimeProjectIds = [];
    if (hackatimeProjects && hackatimeProjects.length > 0) {
      console.log("Processing Hackatime projects:", hackatimeProjects);

      // First, get all existing projects with these names
      const existingProjects = await base("hackatimeProjects")
        .select({
          filterByFormula: `OR(${hackatimeProjects.map((name) => `{name} = '${name}'`).join(",")})`,
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

      // Get current app's existing projects to preserve them
      const currentAppProjects = existingProjects.filter((p) =>
        (p.fields.Apps || []).includes(appId),
      );
      console.log(
        "Current app's existing projects:",
        currentAppProjects.map((p) => p.id),
      );

      // Add all current app's projects to the list to preserve them
      hackatimeProjectIds.push(...currentAppProjects.map((p) => p.id));

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
          if (!hackatimeProjectIds.includes(userProject.id)) {
            hackatimeProjectIds.push(userProject.id);
          }
          console.log(
            `Using existing project for ${projectName}:`,
            userProject.id,
          );

          // Update GitHub link
          await base("hackatimeProjects").update(userProject.id, {
            githubLink: hackatimeProjectGithubLinks?.[projectName] || "",
          });
        } else {
          // Create new project for this user
          console.log(`Creating new project for ${projectName}`);
          try {
            const newProject = await base("hackatimeProjects").create({
              name: projectName,
              neighbor: [userId],
              githubLink: hackatimeProjectGithubLinks?.[projectName] || "",
            });
            hackatimeProjectIds.push(newProject.id);
            console.log(
              `Created new project ${projectName} with ID:`,
              newProject.id,
            );
          } catch (error) {
            console.error(`Failed to create project ${projectName}:`, error);
          }
        }
      }

      console.log(
        "Final project IDs to link (including preserved projects):",
        hackatimeProjectIds,
      );
    }

    // Update app fields
    const appFields = {
      Name: name,
      "App Link": appLink || "",
      "Github Link": githubLink || "",
      Description: description || "",
      hackatimeProjects: hackatimeProjectIds,
    };

    // When updating an attachment field in Airtable, we have two options:
    // 1. If the current field has attachments and we want to keep them, don't include the field
    // 2. If we want to replace them, we need to explicitly set them to null or provide new ones

    // Handle icon - only modify if it's changed
    if (icon) {
      // Check if it's a URL (starting with http:// or https://)
      if (
        typeof icon === "string" &&
        (icon.startsWith("http://") || icon.startsWith("https://"))
      ) {
        console.log("Processing icon URL:", icon.substring(0, 50) + "...");
        appFields.Icon = icon;
        console.log("Set icon URL as text");
      } else {
        console.log("Invalid icon format - must be a URL");
      }
    } else if (currentApp.fields.Icon) {
      // Preserve existing icon if no new one provided
      appFields.Icon = currentApp.fields.Icon;
      console.log("Preserving existing icon");
    }

    // Handle images as comma-separated URLs
    if (images && Array.isArray(images)) {
      console.log("Processing images:", images.length);
      // Filter out any non-URL values and join with commas
      const validUrls = images.filter(
        (url) =>
          typeof url === "string" &&
          (url.startsWith("http://") || url.startsWith("https://")),
      );
      if (validUrls.length > 0) {
        appFields.Images = validUrls.join(",");
        console.log("Set images as comma-separated URLs");
      }
    }

    // Update app record in Apps table
    console.log("Updating app with fields:", Object.keys(appFields));
    const updatedApp = await base("Apps").update([
      {
        id: appId,
        fields: appFields,
      },
    ]);
    console.log("App updated successfully");

    // Get the updated app to return full details
    console.log("\n=== FETCHING APP DETAILS ===");
    const refreshedApp = await base("Apps").find(appId);

    console.log("App fields available:", Object.keys(refreshedApp.fields));
    console.log(
      "Raw hackatime projects from app:",
      refreshedApp.fields.hackatimeProjects,
    );

    // Fetch project names and GitHub links for the hackatime projects
    let projectNames = [];
    let projectGithubLinks = {};
    if (
      refreshedApp.fields.hackatimeProjects &&
      refreshedApp.fields.hackatimeProjects.length > 0
    ) {
      console.log("\n=== FETCHING HACKATIME PROJECTS ===");
      console.log(
        "Number of projects to fetch:",
        refreshedApp.fields.hackatimeProjects.length,
      );

      try {
        // First, let's verify each project ID exists
        for (const projectId of refreshedApp.fields.hackatimeProjects) {
          try {
            const project = await base("hackatimeProjects").find(projectId);
            console.log(`Found project ${projectId}:`, {
              id: project.id,
              fields: project.fields,
              allFields: Object.keys(project.fields),
            });
          } catch (err) {
            console.error(`Failed to fetch project ${projectId}:`, err.message);
          }
        }

        // Now fetch all projects in one go
        const formula = `OR(${refreshedApp.fields.hackatimeProjects.map((id) => `RECORD_ID() = '${id}'`).join(",")})`;
        console.log("Using formula:", formula);

        const projectRecords = await base("hackatimeProjects")
          .select({
            filterByFormula: formula,
          })
          .all();

        console.log("\n=== PROJECT RECORDS FETCHED ===");
        console.log("Number of projects found:", projectRecords.length);

        projectRecords.forEach((record) => {
          console.log(`Project ${record.id}:`, {
            fields: record.fields,
            allFields: Object.keys(record.fields),
          });
        });

        projectRecords.forEach((record) => {
          const name =
            record.fields.name ||
            record.fields.Name ||
            record.fields.PROJECT_NAME;
          if (name) {
            projectNames.push(name);
            projectGithubLinks[name] = record.fields.githubLink || "";
          }
          console.log(
            `Extracted name and GitHub link for project ${record.id}:`,
            { name, githubLink: record.fields.githubLink },
          );
        });

        console.log("\n=== FINAL PROJECT NAMES AND GITHUB LINKS ===");
        console.log("Project data extracted:", {
          names: projectNames,
          githubLinks: projectGithubLinks,
        });
      } catch (error) {
        console.error("\n=== ERROR FETCHING PROJECTS ===");
        console.error("Error:", error);
        console.error("Stack:", error.stack);
      }
    } else {
      console.log("No hackatime projects found in app");
    }

    const appData = {
      id: refreshedApp.id,
      name: refreshedApp.fields.Name || "",
      icon: refreshedApp.fields.Icon || null,
      appLink: refreshedApp.fields["App Link"] || "",
      githubLink: refreshedApp.fields["Github Link"] || "",
      description: refreshedApp.fields.Description || "",
      createdAt: refreshedApp.fields.createdAt || null,
      images: refreshedApp.fields.Images
        ? refreshedApp.fields.Images.split(",")
        : [],
      hackatimeProjects: projectNames,
      hackatimeProjectGithubLinks: projectGithubLinks,
    };

    console.log("\n=== FINAL APP DATA ===");
    console.log("App ID:", appData.id);
    console.log("App Name:", appData.name);
    console.log("Hackatime Projects:", appData.hackatimeProjects);

    return res.status(200).json({
      message: "App updated successfully",
      app: appData,
    });
  } catch (error) {
    console.error("==== DEBUG: UPDATE APP ERROR ====");
    console.error("Error updating app:", error);
    console.error("Error message:", error.message);
    console.error("Error name:", error.name);
    console.error("Status code:", error.statusCode);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    return res.status(500).json({
      message: "Failed to update app",
      error: error.message,
      statusCode: error.statusCode,
    });
  }
}
