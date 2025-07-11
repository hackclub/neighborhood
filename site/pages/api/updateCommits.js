import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

// Simple in-memory mutex to prevent concurrent updates
const updateLocks = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, projectName, commits } = req.body;

  // Sanitize with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  const projectNameRegex = /^[A-Za-z0-9 _-]{3,50}$/;
  if (!tokenRegex.test(token) || !projectNameRegex.test(projectName)) {
    return res
      .status(400)
      .json({ message: "Invalid token or project name format" });
  }
  // Validate commits structure
  if (
    !Array.isArray(commits) ||
    !commits.every(
      (commit) =>
        commit &&
        typeof commit.sha === "string" &&
        typeof commit.message === "string" &&
        typeof commit.date === "string" &&
        typeof commit.url === "string",
    )
  ) {
    return res.status(400).json({ message: "Invalid commits structure" });
  }

  if (!token || !projectName || !commits) {
    return res
      .status(400)
      .json({ message: "Token, App Name, and commits are required" });
  }

  // Create a unique lock key for this project
  const lockKey = `${projectName}-${token}`;

  // Check if there's already an update in progress
  if (updateLocks.has(lockKey)) {
    return res.status(409).json({
      message:
        "An update is already in progress for this project. Please wait a moment and try again.",
    });
  }

  try {
    // Set the lock
    updateLocks.set(lockKey, true);

    console.log("Looking up user with token:", token);
    // First, find the user by token
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      updateLocks.delete(lockKey);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Found user:", userRecords[0].id);
    console.log("Looking up project:", projectName);

    // Find the hackatimeProject record - just match by name
    const hackatimeProjects = await base("hackatimeProjects")
      .select({
        filterByFormula: `LOWER({name}) = LOWER('${projectName}')`,
      })
      .firstPage();

    console.log("Projects found:", hackatimeProjects.length);

    let hackatimeProjectId;

    if (hackatimeProjects.length === 0) {
      // If project not found, create it
      console.log("Creating new project:", projectName);
      const newProject = await base("hackatimeProjects").create({
        fields: {
          name: projectName,
          neighbor: [userRecords[0].id],
        },
      });
      console.log("Created project:", newProject.id);
      hackatimeProjectId = newProject.id;
    } else {
      hackatimeProjectId = hackatimeProjects[0].id;
      console.log("Using existing project:", hackatimeProjectId);
    }

    // Get existing commits for this project
    console.log("Fetching existing commits for project:", hackatimeProjectId);
    const existingCommits = await base("commits")
      .select({
        filterByFormula: `{hackatimeProject} = '${hackatimeProjectId}'`,
      })
      .all();

    console.log("Found existing commits:", existingCommits.length);

    // Create a set of existing commit IDs
    const existingCommitIds = new Set(
      existingCommits.map((record) => record.fields.commitID.trim()),
    );

    // Filter out commits that already exist and ensure unique SHAs
    const seenShas = new Set();
    const newCommits = commits.filter((commit) => {
      const sha = commit.sha.trim();
      if (existingCommitIds.has(sha) || seenShas.has(sha)) {
        return false;
      }
      seenShas.add(sha);
      return true;
    });

    console.log("New unique commits to add:", newCommits.length);

    if (newCommits.length > 0) {
      // Prepare records for creation
      const records = newCommits.map((commit) => {
        // Format date as ISO string (includes time)
        const date = new Date(commit.date);
        const formattedDate = date.toISOString();
        console.log(
          "Processing commit date:",
          commit.date,
          "to:",
          formattedDate,
        );

        return {
          fields: {
            commitID: commit.sha.trim(),
            message: commit.message,
            hackatimeProject: [hackatimeProjectId],
            commitTime: formattedDate,
            githubLink: commit.url,
            neighbor: [userRecords[0].id],
            Type: "github",
          },
        };
      });

      // Create records in batches of 10 (Airtable limit)
      for (let i = 0; i < records.length; i += 10) {
        const batch = records.slice(i, i + 10);
        console.log(`Creating batch ${i / 10 + 1} of commits`);
        await base("commits").create(batch);
      }
    }

    return res.status(200).json({
      message: `Added ${newCommits.length} new commits`,
      newCommits: newCommits,
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error updating commits",
      error: error.message,
    });
  } finally {
    // Always release the lock
    updateLocks.delete(lockKey);
  }
}
