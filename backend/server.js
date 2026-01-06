const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========== CONFIGURATION ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// ========== SESSION STORAGE ==========
const sessions = new Map();

// ========== ROUTES ==========

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Rahl AI Backend' });
});

// Home page - serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// AI Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        // Get or create session
        if (!sessions.has(sessionId)) {
            sessions.set(sessionId, {
                history: [],
                isCodingMode: false,
                currentProject: '',
                files: {}
            });
        }
        
        const session = sessions.get(sessionId);
        
        // Detect coding intent
        const codingTriggers = ['create', 'build', 'make', 'code', 'develop', 'generate'];
        const lowerMsg = message.toLowerCase();
        const isCodingRequest = codingTriggers.some(trigger => lowerMsg.includes(trigger));
        
        // Update session state
        if (isCodingRequest && !session.isCodingMode) {
            session.isCodingMode = true;
            session.currentProject = message;
        }
        
        // Prepare AI prompt
        const systemPrompt = session.isCodingMode 
            ? `You are Rahl AI, a full-stack coding assistant. The user wants to build: "${session.currentProject}".
            
            Respond in this JSON format:
            {
                "message": "Your conversational response",
                "code": "Generated code if applicable",
                "files": {"filename.js": "file content"},
                "shouldUpdate": true/false,
                "isCodingMode": true
            }
            
            Rules:
            1. Generate complete, runnable code
            2. Support multiple languages (HTML, CSS, JS, Python, Node.js, SQL, etc.)
            3. For full-stack projects, create frontend, backend, and database files
            4. Always return valid JSON`
            : `You are Rahl AI, a helpful coding assistant. Respond conversationally.`;
        
        // Call OpenAI API
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                ...session.history.slice(-4),
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 1500
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const aiResponse = response.data.choices[0].message.content;
        
        // Parse response
        let responseData = {
            message: '',
            code: '',
            files: {},
            shouldUpdate: false,
            isCodingMode: session.isCodingMode
        };
        
        if (session.isCodingMode) {
            try {
                const parsed = JSON.parse(aiResponse);
                responseData = { ...responseData, ...parsed };
            } catch (e) {
                responseData.message = aiResponse;
            }
            
            // Update session files if provided
            if (responseData.files && Object.keys(responseData.files).length > 0) {
                session.files = { ...session.files, ...responseData.files };
            }
        } else {
            responseData.message = aiResponse;
        }
        
        // Update history
        session.history.push({ role: 'user', content: message });
        session.history.push({ role: 'assistant', content: aiResponse });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Chat error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Failed to process request',
            message: 'Using fallback response',
            fallback: true
        });
    }
});

// GitHub OAuth - Get Access Token
app.post('/api/github/auth', async (req, res) => {
    try {
        const { code } = req.body;
        
        const response = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code: code
        }, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        res.status(400).json({ error: 'GitHub authentication failed' });
    }
});

// GitHub - Create Repository
app.post('/api/github/create-repo', async (req, res) => {
    try {
        const { accessToken, repoName, description, files } = req.body;
        
        // Create repository
        const repoResponse = await axios.post('https://api.github.com/user/repos', {
            name: repoName,
            description: description || 'Created by Rahl AI',
            private: false,
            auto_init: true
        }, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        // Upload files
        for (const [filename, content] of Object.entries(files)) {
            await axios.put(
                `https://api.github.com/repos/${repoResponse.data.owner.login}/${repoName}/contents/${filename}`,
                {
                    message: `Add ${filename}`,
                    content: Buffer.from(content).toString('base64')
                },
                {
                    headers: {
                        'Authorization': `token ${accessToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
        }
        
        res.json({
            success: true,
            repoUrl: repoResponse.data.html_url,
            cloneUrl: repoResponse.data.clone_url
        });
        
    } catch (error) {
        console.error('GitHub error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create repository' });
    }
});

// Code Execution Endpoint (Sandboxed)
app.post('/api/execute', async (req, res) => {
    try {
        const { code, language } = req.body;
        
        // Simple in-browser execution simulation
        // In production, use a proper sandbox like Judge0 or Piston API
        
        let result = { output: '', error: null };
        
        if (language === 'javascript' && code.includes('console.log')) {
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => logs.push(args.join(' '));
            
            try {
                eval(code);
                result.output = logs.join('\n');
            } catch (e) {
                result.error = e.message;
            }
            
            console.log = originalLog;
        } else if (language === 'python') {
            // For Python, you'd need a backend Python interpreter
            result.output = 'Python execution requires backend setup. Use Judge0 API for production.';
        } else {
            result.output = `Code execution simulated for ${language}`;
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Execution failed' });
    }
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Rahl AI Server running on port ${PORT}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
