Studio Motion free-course email automation

The Learn For Free form posts to:

  /api/free-course

It sends the free course email with Resend and stores consenting leads in Upstash Redis.
The monthly reminder endpoint is:

  /api/monthly-reminder

Vercel runs that endpoint monthly through vercel.json.

Required Vercel environment variables:

  RESEND_API_KEY
  FROM_EMAIL
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN

Recommended Vercel environment variables:

  SUPPORT_EMAIL
  LEAD_NOTIFY_EMAIL
  CRON_SECRET

Notes:

  FROM_EMAIL should be a verified sender/domain in Resend.
  SUPPORT_EMAIL is used for unsubscribe replies.
  LEAD_NOTIFY_EMAIL receives an internal notification for each new lead.
  If CRON_SECRET is set, monthly reminders require that secret in the Authorization header or ?secret= query.
