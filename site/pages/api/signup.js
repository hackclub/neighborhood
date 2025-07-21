import Airtable from "airtable";
import crypto from "crypto";
import { cleanString } from "../../lib/airtable.js";

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

const generateToken = () => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    token += charset[randomIndex];
  }
  return token;
};

const generateOTP = () => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    otp += charset[randomIndex];
  }
  return otp;
};
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

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const records = await base(process.env.AIRTABLE_TABLE_ID)
      .select({
        filterByFormula: `{email} = '${normalizedEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    const otp = generateOTP();

    await base("OTP").create([
      {
        fields: {
          Email: normalizedEmail,
          OTP: otp,
          isUsed: false,
        },
      },
    ]);

    await sendOTPEmail(normalizedEmail, otp);

    if (records.length > 0) {
      return res.status(200).json({
        message: "OTP sent successfully",
        isExisting: true,
      });
    }

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
