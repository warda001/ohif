# 🚨 Netlify 404 Debug Guide

## 🔍 **Check Your Netlify Settings**

1. **Go to Netlify Dashboard** → Your Site → **Site Settings**
2. **Check Build & Deploy Settings**:
   - **Build command**: Should be `yarn build:viewer:ci` 
   - **Publish directory**: Should be `platform/app/dist`
   - **Base directory**: Should be empty or `/`

## 🛠️ **Common Fixes**

### **Fix 1: Correct Publish Directory**
In Netlify Dashboard:
1. Site Settings → Build & Deploy → Continuous Deployment
2. Change **Publish directory** to: `platform/app/dist`
3. Save and redeploy

### **Fix 2: Add netlify.toml File**
Create this file in your **root directory**:

```toml
[build]
  command = "cd platform/app && yarn build:viewer:ci"
  publish = "platform/app/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### **Fix 3: Force Redeploy**
1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Deploy site**

## 🧪 **Test Steps**

1. **Check if files exist**: 
   - Go to `https://wardaohif.netlify.app/index.html` (add `/index.html`)
   - If this works, it's a routing issue

2. **Check build logs**:
   - In Netlify → Deploys → Latest deploy → View build log
   - Look for errors in the build process

3. **Check deploy preview**:
   - Make sure the right branch is deployed

## 🎯 **Expected URLs to Test**

- `https://wardaohif.netlify.app/` (main app)
- `https://wardaohif.netlify.app/index.html` (direct file)
- `https://wardaohif.netlify.app/viewer` (OHIF viewer route)

## 🆘 **If Still Not Working**

Try these **alternative methods**:

1. **Manual Deploy**: 
   - Download your `platform/app/dist` folder as ZIP
   - Drag and drop to Netlify Deploy area

2. **Different Service**:
   - Try **Vercel** or **GitHub Pages** instead
   - Your build files are ready in `dist/` folder

Let me know what you see in your Netlify settings!