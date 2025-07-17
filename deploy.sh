#!/bin/bash

# 🏥 OHIF Medical Imaging Viewer - Quick Deploy Script
# Dataset ID: daae3df7f522b56724aed7e3e544c0fe

echo "🏥 OHIF Medical Imaging Viewer - Quick Deploy"
echo "============================================="
echo ""

# Check if we're in the right directory
if [ ! -d "platform/app/dist" ]; then
    echo "❌ Error: dist folder not found. Please run this script from the project root."
    echo "   Run 'cd platform/app && yarn build:viewer:ci' first to build the project."
    exit 1
fi

echo "✅ Build found at: platform/app/dist/ ($(du -sh platform/app/dist | cut -f1))"
echo ""

# Check if git is initialized and has remote
if [ -d ".git" ] && git remote get-url origin >/dev/null 2>&1; then
    echo "✅ Git repository detected: $(git remote get-url origin)"
    HAS_GIT=true
else
    echo "⚠️  No git repository detected"
    HAS_GIT=false
fi

echo ""
echo "🚀 Deployment Options:"
echo ""
echo "1) Netlify Drop (Fastest - drag & drop)"
echo "2) Vercel CLI (requires npm install -g vercel)"
echo "3) GitHub + Netlify setup instructions"
echo "4) Show build info and exit"
echo ""

read -p "Choose deployment option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🌐 Netlify Drop Deployment:"
        echo "1. Open: https://app.netlify.com/drop"
        echo "2. Drag the entire 'platform/app/dist' folder to the page"
        echo "3. Wait for upload and get your live URL!"
        echo ""
        echo "📁 Dist folder location: $(pwd)/platform/app/dist"
        ;;
    
    2)
        echo ""
        echo "🚀 Vercel CLI Deployment:"
        echo ""
        
        # Check if vercel is installed
        if command -v vercel >/dev/null 2>&1; then
            echo "✅ Vercel CLI found"
            echo "Deploying to Vercel..."
            cd platform/app/dist
            vercel --prod
        else
            echo "❌ Vercel CLI not found. Installing..."
            npm install -g vercel
            echo "✅ Vercel installed. Run the script again to deploy."
        fi
        ;;
    
    3)
        echo ""
        echo "📋 GitHub + Netlify Setup Instructions:"
        echo ""
        
        if [ "$HAS_GIT" = true ]; then
            echo "✅ Your repository: $(git remote get-url origin)"
            echo ""
            echo "Steps:"
            echo "1. Push your code to GitHub (if not already done)"
            echo "2. Go to: https://netlify.com"
            echo "3. Click 'New site from Git'"
            echo "4. Connect your GitHub repository"
            echo "5. Use these build settings:"
            echo "   - Build command: cd platform/app && yarn build:viewer:ci"
            echo "   - Publish directory: platform/app/dist"
            echo "   - Base directory: (leave empty)"
            echo ""
        else
            echo "⚠️  Git repository not detected. You need to:"
            echo "1. Initialize git: git init"
            echo "2. Add remote: git remote add origin <your-github-repo-url>"
            echo "3. Commit and push your code"
            echo "4. Then follow the Netlify setup steps above"
            echo ""
        fi
        ;;
    
    4)
        echo ""
        echo "📊 Build Information:"
        echo "===================="
        echo "• Build Size: $(du -sh platform/app/dist | cut -f1)"
        echo "• OHIF Version: 3.11.0-beta.87"
        echo "• Node Version: $(node --version)"
        echo "• Dataset ID: daae3df7f522b56724aed7e3e544c0fe"
        echo "• Configuration: Production optimized"
        echo ""
        echo "📁 Contents:"
        ls -la platform/app/dist/ | head -10
        echo "... and more files"
        echo ""
        echo "🔗 Your DICOM Dataset:"
        echo "https://www.dicomlibrary.com/?manage=daae3df7f522b56724aed7e3e544c0fe"
        ;;
    
    *)
        echo "❌ Invalid option. Please choose 1-4."
        exit 1
        ;;
esac

echo ""
echo "📖 For more deployment options, see: DEPLOYMENT_SUMMARY.md"
echo "🎉 Your OHIF Medical Imaging Viewer is ready!"