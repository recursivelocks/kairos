# Google Play Store Publishing Guide for Kairos GPS

Since **Kairos GPS** is built as a compliant, mobile-first Progressive Web App (PWA), you can package it into a native Android application package (specifically an `.aab` or Android App Bundle) and publish it to the Google Play Store.

The easiest, most robust way to do this without setting up heavy local development environments (like Java, Gradle, or Android Studio) is using **PWABuilder** (a free tool by Microsoft).

Follow these step-by-step instructions:

---

## Step 1: Host Your PWA Online

Your app is successfully hosted at:
👉 **[https://kairos-e3e51.web.app](https://kairos-e3e51.web.app)**

---

## Step 2: Package with PWABuilder

1. Go to [PWABuilder.com](https://www.pwabuilder.com/).
2. Paste your hosted URL: `https://kairos-e3e51.web.app` into the text box and click **Start**.
3. PWABuilder will analyze your PWA. It will show green checkmarks for your Web App Manifest, Service Worker, and PNG Icons (which are pre-configured in this repository).
4. Click **Package for Stores** and select **Google Play**.
5. Click **Generate Package**.

---

## Step 3: Configure Android App Options

When configuring the package, fill in the options:
*   **Package ID**: `com.recursivelocks.kairosgps`
*   **App Name**: `Kairos GPS`
*   **Launcher Name**: `Kairos GPS`
*   **App Version**: `1.0.0`
*   **Signing Key**: Choose **Generate new signing key**. 
    > [!IMPORTANT]
    > Download and safely back up the signing key (`.keystore` file) and passwords PWABuilder provides. You will need them to publish future updates to your app!

---

## Step 4: Download the Android App Bundle (AAB)

1. Click **Download** to get the zip file.
2. Inside the downloaded zip, you will find:
   - `app-release.aab`: This is your signed Android App Bundle file. This is what you upload to the Google Play Console.
   - `assetlinks.json`: This is used for Digital Asset Links.
3. **Set up Digital Asset Links (Optional but Recommended)**:
   - Upload the `assetlinks.json` file to your hosting site under the path `https://kairos-e3e51.web.app/.well-known/assetlinks.json`.
   - This links your website to your Play Store app, hiding the browser URL bar when users launch the app, giving it a 100% native feel.

---

## Step 5: Upload to Google Play Console

1. Log in to your [Google Play Console](https://play.google.com/console).
2. Click **Create app** and enter details (App name, language, App or Game, Free or Paid).
3. Go to **Testing** -> **Closed testing** or **Production**.
4. Create a new release and upload the `app-release.aab` file.
5. Set up your store listing details (App screenshots, descriptions, icons). You can use the SVG icons in `icons/` or capture screenshots of the running app.
6. Submit the release for review!
