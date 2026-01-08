// neighborhood/site/pages/api/proxy.js
import { createReadStream } from "stream";
import { Readable } from "stream";
// No need to import fetch - it's built-in in Next.js 16+
import { URL } from "url";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ message: "Missing target URL parameter" });
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    return res.status(400).json({ message: "Invalid URL" });
  }

  // Security check - only allow S3 amazonaws URLs
  if (!parsedUrl.hostname.includes("amazonaws.com")) {
    return res.status(403).json({
      message: "Only AWS S3 URLs are allowed for security reasons",
    });
  }

  try {
    // Get raw request body as a buffer for binary data
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve());
      req.on("error", (err) => reject(err));
    });

    const bodyBuffer = Buffer.concat(chunks);

    // Prepare headers for the target request
    const headers = {};

    // Copy all headers from the original request except those that might cause issues
    Object.keys(req.headers).forEach((key) => {
      if (
        !["host", "connection", "content-length", "transfer-encoding"].includes(
          key.toLowerCase(),
        )
      ) {
        headers[key] = req.headers[key];
      }
    });

    // Make request to target with the raw body
    const fetchOptions = {
      method: req.method,
      headers: headers,
      body:
        req.method !== "GET" && req.method !== "HEAD" ? bodyBuffer : undefined,
      redirect: "follow",
    };

    const response = await fetch(targetUrl, fetchOptions);

    // Forward status and headers from the response
    res.statusCode = response.status;

    for (const [key, value] of response.headers.entries()) {
      // Skip headers that might cause issues
      if (
        !["content-encoding", "content-length", "transfer-encoding"].includes(
          key.toLowerCase(),
        )
      ) {
        res.setHeader(key, value);
      }
    }

    // Get response data and send it back
    const responseData = Buffer.from(await response.arrayBuffer());
    return res.send(responseData);
  } catch (err) {
    console.error("CORS Proxy Error:", err);
    return res.status(500).json({
      message: "Failed to proxy request",
      error: err.message,
    });
  }
}

export const config = {
  api: {
    bodyParser: false, // Critical for handling binary data correctly
    responseLimit: false, // No limit on response size
  },
};
