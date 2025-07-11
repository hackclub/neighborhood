import Airtable from "airtable";
import crypto from "crypto";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

// Generate a random token
const generateToken = () => {
  return crypto.randomBytes(40).toString("base64url");
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, fullName, birthday } = req.body;

  // Validate required fields with regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fullNameRegex = /^[a-zA-Z\s]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  if (!fullNameRegex.test(fullName)) {
    return res
      .status(400)
      .json({ message: "Full name can only contain letters and spaces" });
  }

  if (!email || !fullName || !birthday) {
    return res
      .status(400)
      .json({ message: "Email, full name, and birthday are required" });
  }

  // Normalize email by stripping whitespace and converting to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  const sendSignupEmail = async (email) => {
    const url = "https://app.loops.so/api/v1/transactional";
    const payload = {
      transactionalId: "cma7uh0614piwzpnt4awb22mv",
      email: email,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LOOPS_AUTH_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Loops email response:", result);
      return result;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  };

  await sendSignupEmail(normalizedEmail);

  try {
    // Check if user already exists
    const records = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{email} = '${normalizedEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    // If user exists, return success
    if (records.length > 0) {
      return res.status(200).json({
        message: "User already exists",
        isExisting: true,
      });
    }

    // For new users, generate token and create record
    const token = generateToken();
    const newRecord = await base(process.env.AIRTABLE_TABLE_ID).create([
      {
        fields: {
          email: normalizedEmail,
          token: token,
          "Full Name": fullName,
          "Date of Birth": birthday,
        },
      },
    ]);

    return res.status(200).json({
      message: "User registered successfully",
      record: newRecord[0],
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error processing registration",
      error: error.message,
    });
  }
}
