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

// Generate a 4 digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Send OTP email via Loops
const sendOTPEmail = async (email, otp) => {
  const url = "https://app.loops.so/api/v1/transactional";
  const payload = {
    transactionalId: "cma76zj24015peh6e3ipy52yq",
    email: email,
    dataVariables: {
      otp: otp,
    },
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email } = req.body;

  // Sanitize email

  if (typeof email !== "string" || email.length > 254) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  // regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Normalize email by stripping whitespace and converting to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if user already exists
    const records = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{email} = '${normalizedEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    // Generate OTP for this attempt
    const otp = generateOTP();

    // Create OTP record regardless of whether user exists
    await base("OTP").create([
      {
        fields: {
          Email: normalizedEmail,
          OTP: otp,
          isUsed: false,
        },
      },
    ]);

    // Send OTP email
    await sendOTPEmail(normalizedEmail, otp);

    // If user exists, return success without creating new record
    if (records.length > 0) {
      return res.status(200).json({
        message: "OTP sent successfully",
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
        },
      },
    ]);

    return res.status(200).json({
      message: "User registered successfully",
      isExisting: false,
      record: newRecord[0],
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      message: "Error processing registration",
      error: error.message,
    });
  }
}
