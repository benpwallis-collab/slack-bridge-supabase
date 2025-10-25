import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const port = process.env.PORT || 3000;
const SUPABASE_RAG_URL =
  process.env.SUPABASE_RAG_URL ||
  "https://boixlczdemafetxvfcnz.supabase.co/functions/v1/rag-query";
const TENANT_ID = process.env.TENANT_ID || "1564ac06-a1aa-4da5-9287-5eb2ae3ca5a6";

app.get("/", (req, res) => {
  res.status(200).send("InnsynAI Slack bridge (Supabase version) is running ✅");
});

app.post("/ask", async (req, res) => {
  try {
    const question = req.body.text?.trim();
    if (!question) {
      return res.status(200).send("Please provide a question after /ask");
    }

    // call your Supabase rag-query function
    const response = await fetch(SUPABASE_RAG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, tenantId: TENANT_ID }),
    });

    const data = await response.json();
    const answer = data.answer || "I don't know — no relevant info found.";

    // respond to Slack quickly (<3s)
    res.status(200).send(`*Question:* ${question}\n*Answer:* ${answer}`);
  } catch (err) {
    console.error("Error handling /ask:", err);
    res.status(200).send("Something went wrong processing your question.");
  }
});

app.listen(port, () => {
  console.log(`🚀 InnsynAI Supabase Slack bridge running on port ${port}`);
});
