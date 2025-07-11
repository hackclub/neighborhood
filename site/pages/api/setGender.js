import Airtable from "airtable";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { token, gender } = req.body;

  // Check if token is valid with regex
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!tokenRegex.test(token)) {
    return res.status(400).json({ message: "Invalid token format" });
  }

  if (!token || !gender) {
    return res.status(400).json({ message: "Token and gender are required" });
  }

  try {
    // Find the user by token
    const records = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = records[0].id;

    // Update the user's gender
    await base(process.env.AIRTABLE_TABLE_ID).update([
      {
        id: userId,
        fields: {
          RoomGender: gender,
        },
      },
    ]);

    return res.status(200).json({ message: "Gender updated successfully" });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error updating gender",
      error: error.message,
    });
  }
}
