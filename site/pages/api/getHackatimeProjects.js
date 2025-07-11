import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID,
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slackId, userId } = req.query;

  // Validate required parameters with regex

  if (!slackId || !userId) {
    return res.status(400).json({
      error: `Missing required parameters. Received: slackId=${slackId}, userId=${userId}`,
    });
  }

  try {
    // Fetch Hackatime data directly from their API
    const hackatimeUrl = `https://hackatime.hackclub.com/api/v1/users/${slackId}/stats?features=projects&start_date=2025-04-30`;
    console.log(`[DEBUG] Fetching Hackatime data for slackId: ${slackId}`);
    let hackatimeResponse;
    try {
      hackatimeResponse = await fetch(hackatimeUrl, {
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      console.error(`[ERROR] Network error fetching Hackatime API:`, err);
      return res.status(502).json({
        error: `Network error fetching Hackatime API: ${err.message}`,
        stack: err.stack,
      });
    }

    if (!hackatimeResponse.ok) {
      const text = await hackatimeResponse.text();
      console.error(
        `[ERROR] Hackatime API responded with status: ${hackatimeResponse.status}, body: ${text}`,
      );
      return res.status(502).json({
        error: `Hackatime API responded with status: ${hackatimeResponse.status}`,
        body: text,
        url: hackatimeUrl,
      });
    }

    let hackatimeData;
    try {
      hackatimeData = await hackatimeResponse.json();
    } catch (err) {
      console.error(
        `[ERROR] Failed to parse Hackatime API response as JSON:`,
        err,
      );
      return res.status(500).json({
        error: `Failed to parse Hackatime API response as JSON`,
        stack: err.stack,
      });
    }
    if (!hackatimeData?.data?.projects) {
      console.error(
        `[ERROR] No projects found in Hackatime data. Full response:`,
        hackatimeData,
      );
      return res
        .status(404)
        .json({ error: `No projects found in Hackatime data`, hackatimeData });
    }
    console.log(
      "[DEBUG] Hackatime data projects:",
      JSON.stringify(hackatimeData.data.projects, null, 2),
    );

    // Get all project names
    const projectNames = hackatimeData.data.projects.map((p) => p.name);
    console.log("\n=== [DEBUG] Project Details ===");
    console.log("Current User ID:", userId);
    console.log("Project names from Hackatime:", projectNames);

    // Safety check for empty projects array
    if (projectNames.length === 0) {
      console.log(
        "[DEBUG] No projects found in Hackatime data, returning empty array",
      );
      return res.status(200).json({ projects: [] });
    }

    // Use SEARCH() function in Airtable formula to avoid issues with special characters
    const filterFormula = `OR(${projectNames
      .map((name) => {
        // Double the quotes to escape them in Airtable formula string
        const escapedName = name.replace(/"/g, '""');
        return `{name}="${escapedName}"`;
      })
      .join(",")})`;
    console.log("[DEBUG] Airtable filter formula:", filterFormula);

    // Check which projects already exist in Airtable
    let existingProjects;
    try {
      existingProjects = await base("hackatimeProjects")
        .select({
          filterByFormula: filterFormula,
          fields: ["name", "neighbor", "Apps", "email"],
        })
        .all();
    } catch (err) {
      console.error(`[ERROR] Airtable query failed:`, err);
      return res.status(500).json({
        error: `Airtable query failed`,
        stack: err.stack,
        filterFormula,
        userId,
      });
    }

    console.log("\n=== [DEBUG] Airtable Project Details ===");
    console.log("Current User ID:", userId);
    existingProjects.forEach((p) => {
      const isUserNeighbor = (p.fields.neighbor || []).includes(userId);
      console.log(`\nProject "${p.fields.name}" (${p.id}):`, {
        name: p.fields.name,
        recordId: p.id,
        currentUserId: userId,
        rawNeighborField: p.fields.neighbor,
        neighborIds: p.fields.neighbor || [],
        neighborCount: (p.fields.neighbor || []).length,
        isUserNeighbor,
        apps: p.fields.Apps || [],
        email: p.fields.email,
      });
    });

    // Create a map to store project attribution and user association
    const projectStatusMap = new Map();

    // First pass: gather all project statuses
    console.log("\n=== [DEBUG] Processing Project Statuses ===");
    console.log("Current User ID:", userId);
    existingProjects.forEach((project) => {
      const neighborIds = project.fields.neighbor || [];
      const isUserProject = neighborIds.includes(userId);

      console.log(`\nProject "${project.fields.name}":`, {
        projectId: project.id,
        currentUserId: userId,
        neighborField: {
          raw: project.fields.neighbor,
          processed: neighborIds,
          count: neighborIds.length,
          includesUser: isUserProject,
        },
        userCheck: {
          userId: userId,
          isInNeighbors: isUserProject,
          neighborContents: neighborIds,
          exactComparison: neighborIds.map(
            (id) => `${id} === ${userId} : ${id === userId}`,
          ),
        },
        apps: {
          appIds: project.fields.Apps || [],
        },
      });

      // Removed isAttributed logic to allow all users to claim any project
      projectStatusMap.set(project.fields.name, {
        isUserProject,
        attributedToAppId: project.fields.Apps ? project.fields.Apps[0] : null,
      });
    });

    // Add attribution status to each project
    console.log("\n=== [DEBUG] Final Project Statuses ===");
    const projectsWithStatus = hackatimeData.data.projects.map((project) => {
      const status = projectStatusMap.get(project.name) || {
        isUserProject: false,
        attributedToAppId: null,
      };

      console.log(`\nProject "${project.name}":`, {
        fromHackatime: {
          name: project.name,
          totalSeconds: project.total_seconds,
        },
        fromAirtable: projectStatusMap.get(project.name),
        finalStatus: {
          isUserProject: status.isUserProject,
          attributedToAppId: status.attributedToAppId,
        },
      });

      return {
        ...project,
        isUserProject: status.isUserProject,
        attributedToAppId: status.attributedToAppId,
        totalSeconds: project.total_seconds,
      };
    });

    console.log("\n=== [DEBUG] Summary ===");
    console.log(
      "Projects being returned:",
      projectsWithStatus.map((p) => ({
        name: p.name,
        isUserProject: p.isUserProject,
        attributedToAppId: p.attributedToAppId,
        totalSeconds: p.total_seconds,
      })),
    );

    // Return the projects data with attribution status
    return res.status(200).json({
      projects: projectsWithStatus || [],
    });
  } catch (error) {
    console.error(
      "[FATAL ERROR] Unexpected error in getHackatimeProjects:",
      error,
    );
    return res.status(500).json({
      error: "Unexpected error in getHackatimeProjects",
      message: error.message,
      stack: error.stack,
      slackId,
      userId,
    });
  }
}
