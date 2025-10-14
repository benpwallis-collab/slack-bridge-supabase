import pkg from "@slack/bolt";
const { App, ExpressReceiver } = pkg;
import fetch from "node-fetch";
import bodyParser from "body-parser";

// ENV
const {
  SLACK_SIGNING_SECRET,
  SLACK_BOT_TOKEN,
  SLACK_TENANT_LOOKUP_URL,
  RAG_QUERY_URL,
  SUPABASE_ANON_KEY,
  PORT = 3000
} = process.env;

// Express health check
const receiver = new ExpressReceiver({ signingSecret: SLACK_SIGNING_SECRET });
receiver.app.use(bodyParser.json());
receiver.app.get("/health", (_req, res) => res.status(200).send("ok"));

// Slack Bolt app
const app = new App({ token: SLACK_BOT_TOKEN, receiver });

app.command("/ask", async ({ command, ack, respond }) => {
  await ack();

  const question = (command.text || "").trim();
  const userId = command.user_id;
  const teamId = command.team_id;

  if (!question) {
    await respond({
      text: "Type a question after `/ask`, e.g. `/ask What is our leave policy?`",
      response_type: "ephemeral"
    });
    return;
  }

  // 1. Immediate feedback
  await respond({
    text: `⏳ Searching for: *${question}* ...`,
    response_type: "ephemeral"
  });

  try {
    // 2. Look up tenant ID via Lovable function
    console.log(`🔍 Looking up tenant for Slack team: ${teamId}`);
    const tenantRes = await fetch(SLACK_TENANT_LOOKUP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ slack_team_id: teamId })
    });

    if (!tenantRes.ok) {
      throw new Error(`Failed to resolve tenant. Status: ${tenantRes.status}`);
    }

    const { tenant_id } = await tenantRes.json();

    // 3. Send question to Lovable RAG endpoint
    const ragRes = await fetch(RAG_QUERY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "x-tenant-id": tenant_id
      },
      body: JSON.stringify({
        question,
        userEmail: userId  // You can also map to email later
      })
    });

    const ragData = await ragRes.json();
    const answer = ragData.answer || ragData.text || "No answer found.";

    // 4. Final response
    await respond({
      text: `💡 *Answer to:* ${question}\n\n${answer}`,
      response_type: "ephemeral"
    });

  } catch (error) {
    console.error("Slack bridge error:", error);
    await respond({
      text: "❌ Sorry, something went wrong while processing your question.",
      response_type: "ephemeral"
    });
  }
});

(async () => {
  await app.start(PORT);
  console.log(`⚡️ Slack bridge running on port ${PORT}`);
})();
