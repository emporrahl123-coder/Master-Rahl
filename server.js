const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Store conversation history per session (simple memory)
const sessions = {};

// Generate session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Route to handle chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    // Get or create session
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        history: [],
        isCodingMode: false,
        currentProject: ''
      };
    }
    
    const session = sessions[sessionId];
    
    // Add user message to history
    session.history.push({ role: 'user', content: message });
    
    // Detect coding intent
    const codingTriggers = ['create', 'build', 'make', 'code', 'develop', 'generate', 'write code'];
    const lowerMsg = message.toLowerCase();
    const isCodingRequest = codingTriggers.some(trigger => lowerMsg.includes(trigger));
    
    // If coding request detected, switch to coding mode
    if (isCodingRequest && !session.isCodingMode) {
      session.isCodingMode = true;
      session.currentProject = message;
    }
    
    // Check for exit coding mode
    if (session.isCodingMode && 
        (lowerMsg.includes('exit coding') || lowerMsg.includes('back to chat'))) {
      session.isCodingMode = false;
      session.currentProject = '';
    }
    
    // Prepare AI prompt based on mode
    let systemPrompt = '';
    if (session.isCodingMode) {
      systemPrompt = `You are a coding assistant. The user wants to build: "${session.currentProject}".
      
You MUST respond in this EXACT JSON format:
{
  "message": "Your response text here",
  "code": "The HTML/CSS/JS code here",
  "shouldUpdateCode": true/false
}

Rules:
1. Keep "message" conversational and helpful
2. "code" should be complete HTML file with <style> and <script> tags if needed
3. "shouldUpdateCode" should be true if you're providing new/modified code
4. If user describes changes, update the code accordingly
5. Always return valid JSON`;
    } else {
      systemPrompt = `You are a helpful AI assistant. Respond conversationally.`;
    }
    
    // Prepare messages for AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.history.slice(-6) // Last 3 exchanges
    ];
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const aiResponse = data.choices[0].message.content;
    
    // Parse response based on mode
    let responseObj = {
      message: '',
      code: '',
      shouldUpdateCode: false,
      isCodingMode: session.isCodingMode
    };
    
    if (session.isCodingMode) {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(aiResponse);
        responseObj.message = parsed.message || aiResponse;
        responseObj.code = parsed.code || '';
        responseObj.shouldUpdateCode = parsed.shouldUpdateCode || false;
      } catch {
        // If not JSON, use as plain message
        responseObj.message = aiResponse;
      }
    } else {
      responseObj.message = aiResponse;
    }
    
    // Add AI response to history
    session.history.push({ role: 'assistant', content: aiResponse });
    
    res.json(responseObj);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
