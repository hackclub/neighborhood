import Airtable from "airtable";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

const rateLimits = new Map();

function sanitizeOTP(otpString) {
  if (!otpString) return "";
  return otpString.toString().replace(/[^a-zA-Z0-9]/g, "");
}

function istoofast(email, ip) {
  const now = Date.now();
  const key = `${email}_${ip}`;
  const limit = rateLimits.get(key) || { count: 0, reset: now + 300000 };

  if (now > limit.reset) {
    limit.count = 0;
    limit.reset = now + 300000;
  }

  if (limit.count >= 5) {
    return false;
  }

  limit.count++;
  rateLimits.set(key, limit);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, otp } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    console.log("Invalid email format:", email);
    return res.status(400).json({ message: "Invalid email format" });
  }

  const otpRegex = /^[a-zA-Z0-9]{6}$/;
  if (!otp || !otpRegex.test(otp)) {
    console.log("Invalid OTP format:", otp);
    return res.status(400).json({ message: "Invalid OTP format" });
  }

  if (!istoofast(email, ip)) {
    console.log("Rate limit exceeded for:", email, ip);
    return res.status(429).json({ message: "Too many attempts" });
  }

  if (!email || !otp) {
    console.log("email and otp are required");
    console.log("email", email);
    console.log("otp", otp);
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const sanitizedOTP = sanitizeOTP(otp);

    const otpRecords = await base("OTP")
      .select({
        filterByFormula: `AND({Email} = '${email}', {isUsed} = 0)`,
        sort: [{ field: "createdAt", direction: "desc" }],
        maxRecords: 1,
      })
      .firstPage();

    if (otpRecords.length === 0) {
      console.log("No valid OTP found for email:", email);
      return res.status(400).json({ message: "No valid OTP found" });
    }

    const latestOTP = otpRecords[0];
    const sanitizedStoredOTP = sanitizeOTP(latestOTP.fields.OTP);

    if (sanitizedStoredOTP !== sanitizedOTP) {
      console.log("OTP validation failed");
      console.log("Expected OTP:", sanitizedStoredOTP);
      console.log("Received OTP:", sanitizedOTP);

      if (process.env.NODE_ENV !== "production") {
        console.log("Original stored OTP:", latestOTP.fields.OTP);
        console.log("Original received OTP:", otp);
        console.log("Stored OTP length:", sanitizedStoredOTP.length);
        console.log("Received OTP length:", sanitizedOTP.length);
      }

      return res.status(400).json({ message: "Invalid OTP" });
    }

    await base("OTP").update([
      {
        id: latestOTP.id,
        fields: {
          isUsed: true,
        },
      },
    ]);

    const userRecords = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{email} = '${email}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (userRecords.length === 0) {
      console.log("User not found for email:", email);
      return res.status(404).json({ message: "User not found" });
    }

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
