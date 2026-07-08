const DISCORD_URL = "https://discord.gg/UVqkJ9SNwy";
const CONSENT_TEXT = "I agree to receive emails, updates, and business inquiries from Studio Motion. I understand I can unsubscribe at any time.";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function freeCourseEmailHtml() {
  return `
    <div style="margin:0;padding:0;background:#050505;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#0b0712;border:1px solid rgba(168,85,247,.35);border-radius:18px;padding:28px;">
          <img src="https://www.studiomotion.org/assets/motion-logo.png" alt="Studio Motion" width="74" height="74" style="border-radius:18px;display:block;margin-bottom:22px;">
          <h1 style="font-size:32px;line-height:1.05;margin:0 0 14px;color:#fff;">Welcome to the free Motion course.</h1>
          <p style="font-size:16px;line-height:1.65;color:#d1d5db;margin:0 0 18px;">Inside the free course, we break down how faceless YouTube channels are built, how creators pick niches, and why simple systems beat guessing. It is built to help you understand the model before you decide whether Motion is right for you.</p>
          <p style="font-size:16px;line-height:1.65;color:#d1d5db;margin:0 0 18px;">You also get access to free group calls and a free community with over 3,000 YouTubers learning, testing ideas, and building channels together.</p>
          <a href="${DISCORD_URL}" style="display:inline-block;background:#9333ea;color:#fff;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:700;">Join the free community</a>
          <p style="font-size:13px;line-height:1.55;color:#9ca3af;margin:24px 0 0;">If the button does not work, use this link: ${DISCORD_URL}</p>
        </div>
      </div>
    </div>
  `;
}

function freeCourseEmailText() {
  return [
    "Welcome to the free Motion course.",
    "",
    "Inside the free course, we break down how faceless YouTube channels are built, how creators pick niches, and why simple systems beat guessing.",
    "",
    "You also get access to free group calls and a free community with over 3,000 YouTubers.",
    "",
    `Join here: ${DISCORD_URL}`
  ].join("\n");
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || "Studio Motion <learn@studiomotion.org>";
  if (!apiKey) throw new Error("Missing RESEND_API_KEY.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<mailto:${process.env.SUPPORT_EMAIL || "support@studiomotion.org"}?subject=Unsubscribe>`
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email send failed: ${detail}`);
  }
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) throw new Error("Lead storage failed.");
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const consent = body.consent === true;

    if (!isEmail(email)) return json(res, 400, { ok: false, error: "Please enter a valid email." });
    if (!consent) return json(res, 400, { ok: false, error: "Email consent is required." });

    const now = new Date().toISOString();
    await redisCommand(["HSET", `motion_lead:${email}`, "email", email, "phone", phone, "consent", "true", "consentText", CONSENT_TEXT, "createdAt", now, "lastReminderAt", ""]);
    await redisCommand(["SADD", "motion_leads", email]);

    await sendEmail({
      to: email,
      subject: "Your free Studio Motion course is inside",
      html: freeCourseEmailHtml(),
      text: freeCourseEmailText()
    });

    if (process.env.LEAD_NOTIFY_EMAIL) {
      await sendEmail({
        to: process.env.LEAD_NOTIFY_EMAIL,
        subject: "New Studio Motion free-course lead",
        html: `<p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone || "Not provided"}</p><p><strong>Consent:</strong> ${CONSENT_TEXT}</p>`,
        text: `Email: ${email}\nPhone: ${phone || "Not provided"}\nConsent: ${CONSENT_TEXT}`
      });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message || "Could not submit the form." });
  }
};
