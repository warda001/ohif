# 🔧 Manual Fix Guide for Netlify Deployment

## ❌ Git Push Issue
I cannot push changes to your repository due to permission restrictions. Here's exactly what needs to be changed:

---

## 📁 File to Edit: `extensions/dicom-library-datasource/package.json`

**Location**: `ohif/extensions/dicom-library-datasource/package.json`

**Current Line 23** (INCORRECT):
```json
"cornerstone-wado-image-loader": "^4.13.3"
```

**Change to** (CORRECT):
```json
"cornerstone-wado-image-loader": "^4.13.2"
```

### Complete Section Should Look Like:
```json
{
  "name": "@ohif/extension-dicom-library-datasource",
  "version": "3.0.0",
  "description": "DICOM Library data source extension for OHIF Viewer",
  "author": "OHIF",
  "license": "MIT",
  "main": "dist/index.umd.js",
  "files": [
    "dist",
    "README.md"
  ],
  "repository": "OHIF/Viewers",
  "keywords": [
    "ohif-extension",
    "dicom",
    "medical",
    "imaging"
  ],
  "peerDependencies": {
    "@ohif/core": "^3.0.0"
  },
  "dependencies": {
    "dicom-parser": "^1.8.13",
    "cornerstone-wado-image-loader": "^4.13.2"
  }
}
```

---

## 🔄 After Making the Change

1. **Save the file**
2. **Update yarn.lock** by running:
   ```bash
   cd ohif
   yarn install
   ```
3. **Commit and push**:
   ```bash
   git add extensions/dicom-library-datasource/package.json yarn.lock
   git commit -m "Fix cornerstone-wado-image-loader version from 4.13.3 to 4.13.2"
   git push origin master
   ```

---

## ✅ Expected Result

- ✅ Netlify build will succeed
- ✅ No more `error Couldn't find any versions for "cornerstone-wado-image-loader" that matches "^4.13.3"`
- ✅ Your OHIF viewer will deploy with DICOM dataset: `daae3df7f522b56724aed7e3e544c0fe`

---

## 🎯 Root Cause
Version `4.13.3` does not exist on npm. The latest available version is `4.13.2`. The package.json was referencing a non-existent version, causing the yarn installation to fail during Netlify deployment.

That's it! One simple line change fixes the entire deployment issue.