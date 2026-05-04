// ══════════════════════════════════════════════════════════
//  AI LIBRARIAN - Mood based book suggester + chat
//  POST /api/ai/suggest
//  Body: { message: "I'm feeling sad and want something uplifting" }
// ══════════════════════════════════════════════════════════
app.post("/api/ai/suggest", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    // Step 1: Fetch all books from database
    db.query("SELECT title, author, category FROM books LIMIT 200", async (err, books) => {
      if (err) return res.status(500).json({ error: "Failed to fetch books." });

      // Step 2: Build book list string for Gemini
      const bookList = books
        .map((b) => `"${b.title}" by ${b.author} (${b.category || "General"})`)
        .join("\n");

      // Step 3: Create prompt for Gemini
      const prompt = `
You are a friendly AI librarian assistant for a library management system.
A student said: "${message}"

Here are the books available in our library:
${bookList}

Based on what the student said (their mood, interest, or request), suggest 3-5 books from the list above that would be perfect for them.
For each book give:
- Book title and author
- One sentence explaining why it matches their mood/request

Also give a short warm friendly intro message (1-2 sentences) before the suggestions.
Keep your response friendly, short and encouraging!
If the student is just chatting (not asking for books), respond warmly as a helpful librarian.
      `;

      // Step 4: Call Gemini API
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text();

      res.json({ reply: aiResponse });
    });
  } catch (error) {
    console.error("Gemini API error:", error.message);
    res.status(500).json({ error: "AI is unavailable right now.", details: error.message });
  }
});