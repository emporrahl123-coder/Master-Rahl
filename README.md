# Rahl AI - Deployment Guide

## 1. GitHub OAuth App Setup

### Step 1: Create GitHub OAuth App
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Rahl AI
   - **Homepage URL**: `https://rahl-ai.onrender.com` (after deployment)
   - **Authorization callback URL**: `https://rahl-ai.onrender.com/api/github/callback`
4. Click "Register application"

### Step 2: Get Client ID & Secret
1. Copy your **Client ID**
2. Generate a new **Client Secret**
3. Save both for Render environment variables

## 2. OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. Copy the key

## 3. Deploy to Render

### Method A: One-Click Deploy
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/rahl-ai)

### Method B: Manual Deployment
1. Push this code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Create new Web Service
4. Connect your GitHub repository
5. Configure:
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
6. Add environment variables:
   - `OPENAI_API_KEY` = your OpenAI key
   - `GITHUB_CLIENT_ID` = from GitHub OAuth
   - `GITHUB_CLIENT_SECRET` = from GitHub OAuth
7. Click "Create Web Service"

## 4. Update GitHub OAuth Settings
After deployment, get your Render URL and update:
1. Go back to GitHub OAuth App settings
2. Update:
   - **Homepage URL**: `https://your-service-name.onrender.com`
   - **Callback URL**: `https://your-service-name.onrender.com/api/github/callback`

## 5. Test Your Deployment
1. Open your Render URL
2. Try: "Create a React app with a counter"
3. Test GitHub integration

## Environment Variables Reference
| Variable | Description | Required |
|----------|-------------|----------|
| OPENAI_API_KEY | OpenAI API key | ✅ |
| GITHUB_CLIENT_ID | GitHub OAuth Client ID | ✅ |
| GITHUB_CLIENT_SECRET | GitHub OAuth Client Secret | ✅ |
| PORT | Server port (default: 3000) | ❌ |

## Support
For issues, check:
1. Render logs: `https://dashboard.render.com/logs`
2. Ensure all environment variables are set
3. Verify GitHub OAuth callback URLs match
