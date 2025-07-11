import Airtable from "airtable";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, githubUsername } = req.body;

  // check if token is a valid token using regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!token || !tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  // Check for missing fields
  if (!token) {
    return res.status(400).json({ message: "Missing required field: token" });
  }

  try {
    // Find the user record by token
    const userRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res
        .status(404)
        .json({ message: "User not found for provided token" });
    }

    // Update the user's GitHub username
    await base("neighbors").update([
      {
        id: userRecords[0].id,
        fields: {
          githubUsername: githubUsername || "",
        },
      },
    ]);

    return res
      .status(200)
      .json({ message: "GitHub username updated successfully" });
  } catch (error) {
    console.error("Error in connectGithubUsername:", error);
    return res
      .status(500)
      .json({
        message: "Error updating GitHub username",
        error: error.message,
      });
  }
}
