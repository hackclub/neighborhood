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

  const { token, projectName, sessions, sessionCommitMatches } = req.body;

  // Sanitize fields with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  const projectNameRegex = /^[A-Za-z0-9 _-]{3,50}$/;
  if (!tokenRegex.test(token) || !projectNameRegex.test(projectName)) {
    return res
      .status(400)
      .json({ message: "Invalid token or project name format" });
  }

  if (!token || !projectName || !sessions) {
    return res
      .status(400)
      .json({ message: "Token, App Name, and sessions are required" });
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

    // Find the hackatimeProject record
    const hackatimeProjects = await base("hackatimeProjects")
      .select({
        filterByFormula: `LOWER({name}) = LOWER('${projectName}')`,
      })
      .firstPage();

    if (hackatimeProjects.length === 0) {
      updateLocks.delete(lockKey);
      return res.status(404).json({ message: "Project not found" });
    }

    const hackatimeProjectId = hackatimeProjects[0].id;

    // Get existing sessions for this project
    console.log("Fetching existing sessions for project:", hackatimeProjectId);
    const existingSessions = await base("sessions")
      .select({
        filterByFormula: `{hackatimeProject} = '${hackatimeProjectId}'`,
      })
      .all();

    // Create a set of existing session IDs (using start_time as unique identifier)
    const existingSessionIds = new Set(
      existingSessions.map((record) => record.fields.sessionID?.toString()),
    );

    // Get all commits for this project to establish links
    const commits = await base("commits")
      .select({
        filterByFormula: `{hackatimeProject} = '${hackatimeProjectId}'`,
      })
      .all();

    // Create a map of commit SHA to record ID
    const commitIdMap = new Map(
      commits.map((commit) => [commit.fields.commitID.trim(), commit.id]),
    );

    // Filter out sessions that already exist and ensure unique sessionIDs
    const seenSessionIds = new Set();
    const newSessions = sessions.filter((session) => {
      const sessionId = session.start_time.toString();
      if (existingSessionIds.has(sessionId) || seenSessionIds.has(sessionId)) {
        return false;
      }
      seenSessionIds.add(sessionId);
      return true;
    });

    console.log("New sessions to add:", newSessions.length);

    if (newSessions.length > 0) {
      // Prepare records for creation
      const records = newSessions.map((session) => {
        const startTime = new Date(session.start_time * 1000).toISOString();
        const endTime = new Date(
          (session.start_time + session.duration) * 1000,
        ).toISOString();

        // Get the matching commit if it exists
        const matchingCommit = sessionCommitMatches?.[session.start_time];
        const commitRecordId = matchingCommit
          ? commitIdMap.get(matchingCommit.sha.trim())
          : null;

        const fields = {
          sessionID: session.start_time.toString(),
          startTime: startTime,
          endTime: endTime,
          duration: session.duration,
          hackatimeProject: [hackatimeProjectId],
          neighbor: [userRecords[0].id],
          Type: "hackatime",
        };

        // Only add commit link if we have a matching commit
        if (commitRecordId) {
          fields.commit = [commitRecordId];
        }

        return { fields };
      });

      // Create records in batches of 10 (Airtable limit)
      for (let i = 0; i < records.length; i += 10) {
        const batch = records.slice(i, i + 10);
        console.log(`Creating batch ${i / 10 + 1} of sessions`);
        await base("sessions").create(batch);
      }
    }

    return res.status(200).json({
      message: `Added ${newSessions.length} new sessions`,
      newSessions: newSessions,
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error updating sessions",
      error: error.message,
    });
  } finally {
    // Always release the lock
    updateLocks.delete(lockKey);
  }
}
