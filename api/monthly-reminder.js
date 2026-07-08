const SUBJECT = "YouTubers are making Thousands from this model";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash Redis environment variables.");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) throw new Error("Redis request failed.");
  return response.json();
}

function toObject(values) {
  const out = {};
  if (!Array.isArray(values)) return out;
  for (let index = 0; index < values.length; index += 2) {
    out[values[index]] = values[index + 1];
  }
  return out;
}

async function sendEmail({ to, html, text }) {
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
      subject: SUBJECT,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<mailto:${process.env.SUPPORT_EMAIL || "support@studiomotion.org"}?subject=Unsubscribe>`
      }
    })
  });

  if (!response.ok) throw new Error(await response.text());
}

function reminderHtml() {
  return `
    <div style="margin:0;padding:0;background:#050505;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:#0b0712;border:1px solid rgba(168,85,247,.35);border-radius:18px;padding:28px;">
          <img src="https://www.studiomotion.org/assets/motion-logo.png" alt="Studio Motion" width="74" height="74" style="border-radius:18px;display:block;margin-bottom:22px;">
          <h1 style="font-size:30px;line-height:1.08;margin:0 0 14px;color:#fff;">Have you joined Motion yet?</h1>
          <p style="font-size:16px;line-height:1.65;color:#d1d5db;margin:0 0 16px;">YouTubers are making thousands from faceless channels because the model is simple: choose the right niche, edit for retention, scale safely, and keep getting feedback instead of guessing alone.</p>
          <p style="font-size:16px;line-height:1.65;color:#d1d5db;margin:0 0 16px;">Motion gives you the niche library, editing frameworks, scaling rules, accountability, direct support, group calls, and a system built from mistakes you do not need to repeat.</p>
          <p style="font-size:16px;line-height:1.65;color:#d1d5db;margin:0 0 22px;">If you want $5K-$10K/month from faceless YouTube, the fastest path is not more motivation. It is structure.</p>
          <a href="https://www.studiomotion.org/" style="display:inline-block;background:#9333ea;color:#fff;text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:700;">Join Motion</a>
        </div>
      </div>
    </div>
  `;
}

function reminderText() {
  return [
    "Have you joined Motion yet?",
    "",
    "YouTubers are making thousands from faceless channels because the model is simple: choose the right niche, edit for retention, scale safely, and keep getting feedback instead of guessing alone.",
    "",
    "Motion gives you the niche library, editing frameworks, scaling rules, accountability, direct support, group calls, and a system built from mistakes you do not need to repeat.",
    "",
    "Join Motion: https://www.studiomotion.org/"
  ].join("\n");
}

module.exports = async function handler(req, res) {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = req.query && req.query.secret;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (expectedSecret && providedSecret !== expectedSecret && bearer !== expectedSecret) {
    return json(res, 401, { ok: false, error: "Unauthorized." });
  }

  try {
    const members = await redisCommand(["SMEMBERS", "motion_leads"]);
    const emails = members.result || [];
    let sent = 0;

    for (const email of emails) {
      const leadResponse = await redisCommand(["HGETALL", `motion_lead:${email}`]);
      const lead = toObject(leadResponse.result);
      if (!lead.email || lead.consent !== "true") continue;

      await sendEmail({
        to: lead.email,
        html: reminderHtml(),
        text: reminderText()
      });
      await redisCommand(["HSET", `motion_lead:${lead.email}`, "lastReminderAt", new Date().toISOString()]);
      sent += 1;
    }

    return json(res, 200, { ok: true, sent });
  } catch (error) {
    return json(res, 500, { ok: false, error: error.message || "Reminder send failed." });
  }
};
