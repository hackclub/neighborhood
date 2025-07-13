import Airtable from "airtable";
import { cleanString } from "../../lib/airtable.js";

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

/**
 * Sanitizes an OTP string by removing non-digit characters
 * @param {string} otpString - The OTP string to sanitize
 * @returns {string} - The sanitized OTP containing only digits
 */
function sanitizeOTP(otpString) {
  if (!otpString) return "";
  return otpString.toString().replace(/[^\d]/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, otp, token } = req.body;

  if (!email || !otp || !token) {
    console.log("email and otp are required");
    console.log("email", email);
    console.log("otp", otp);
    console.log("token", token);
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const cleanedEmail = cleanString(email);
  const cleanedOtp = cleanString(otp);
  const cleanedToken = cleanString(token);

  // Validate email format with regex + token format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;
  if (!cleanedEmail || !emailRegex.test(cleanedEmail)) {
    console.log("Invalid email format:", cleanedEmail);
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (!cleanedToken || !tokenRegex.test(cleanedToken)) {
    console.log("Invalid token format:", cleanedToken);
    return res.status(400).json({ message: "Invalid token format" });
  }
  if (!cleanedOtp || cleanedOtp.length < 4 || cleanedOtp.length > 6) {
    console.log("Invalid OTP length:", cleanedOtp);
    return res.status(400).json({ message: "Invalid OTP length" });
  }
  if (typeof cleanedOtp !== "string") {
    console.log("OTP must be a string:", cleanedOtp);
    return res.status(400).json({ message: "OTP must be a string" });
  }
  if (cleanedOtp.includes(" ")) {
    console.log("OTP should not contain spaces:", cleanedOtp);
    return res.status(400).json({ message: "OTP should not contain spaces" });
  }
  try {
    // Sanitize the input OTP
    const sanitizedOTP = sanitizeOTP(cleanedOtp);

    // Get the most recent OTP record for this email that hasn't been used
    const otpRecords = await base("OTP")
      .select({
        filterByFormula: `AND({Email} = '${cleanedEmail}', {isUsed} = 0)`,
        sort: [{ field: "createdAt", direction: "desc" }],
        maxRecords: 1,
      })
      .firstPage();

    if (otpRecords.length === 0) {
      console.log("No valid OTP found for email:", cleanedEmail);
      return res.status(400).json({ message: "No valid OTP found" });
    }

    const latestOTP = otpRecords[0];
    // Sanitize the stored OTP as well to ensure consistent comparison
    const sanitizedStoredOTP = sanitizeOTP(latestOTP.fields.OTP);

    // Check if OTP matches
    if (sanitizedStoredOTP !== sanitizedOTP) {
      console.log("OTP validation failed");
      console.log("Expected OTP:", sanitizedStoredOTP);
      console.log("Received OTP:", sanitizedOTP);

      // Debug info if needed
      if (process.env.NODE_ENV !== "production") {
        console.log("Original stored OTP:", latestOTP.fields.OTP);
        console.log("Original received OTP:", cleanedOtp);
        console.log("Stored OTP length:", sanitizedStoredOTP.length);
        console.log("Received OTP length:", sanitizedOTP.length);
      }

      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark OTP as used
    await base("OTP").update([
      {
        id: latestOTP.id,
        fields: {
          isUsed: true,
        },
      },
    ]);

    // Get user's token from the main table
    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{token} = '${cleanedToken}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      console.log("User not found for email:", cleanedEmail);
      return res.status(404).json({ message: "User not found" });
    }

    // Set new email
    await base(process.env.AIRTABLE_TABLE_ID).update([
      {
        id: userRecords[0].id,
        fields: {
          email: cleanedEmail,
        },
      },
    ]);

    return res.status(200).json({
      message: "OTP verified successfully",
      token: userRecords[0].fields.token,
    });
  } catch (error) {
    console.error("Airtable Error:", error);
    return res.status(500).json({
      message: "Error verifying OTP",
      error:
        process.env.NODE_ENV === "production" ? "Server error" : error.message,
    });
  }
}
