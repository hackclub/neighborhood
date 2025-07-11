import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const { country, hasVisa, airport } = req.body;
  if (!country || typeof hasVisa === "undefined" || !airport) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Sanitize all of the inputs with regex
  const countryRegex = /^[A-Za-z\s]+$/; // Allow letters and spaces
  const airportRegex = /^[A-Za-z0-9\s\-]+$/; // Allow letters, numbers, spaces, and hyphens
  // Check the hasVisa type, should be a boolean
  if (typeof hasVisa !== "boolean") {
    return res.status(400).json({ message: "hasVisa must be a boolean" });
  }

  if (!countryRegex.test(country) || !airportRegex.test(airport)) {
    return res.status(400).json({ message: "Invalid input format" });
  }
  if (typeof hasVisa !== "boolean") {
    return res.status(400).json({ message: "hasVisa must be a boolean" });
  }
  // Ensure the token is a valid format
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  try {
    // Find the user by token
    const userRecords = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      return res
        .status(403)
        .json({ message: "User not found", shouldLogout: true });
    }

    const userRecord = userRecords[0];
    const userId = userRecord.id;

    // Update the user's travel info
    await base("neighbors").update([
      {
        id: userId,
        fields: {
          country,
          hasVisa,
          airport,
        },
      },
    ]);

    // Optionally, return the updated fields
    return res.status(200).json({
      success: true,
      country,
      hasVisa,
      airport,
    });
  } catch (error) {
    console.error("Error updating user travel info:", error);
    return res.status(500).json({
      message: "Error updating user travel info",
      error: error.message,
    });
  }
}
