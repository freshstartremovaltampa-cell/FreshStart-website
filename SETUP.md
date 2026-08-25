# FreshStart iOS App — Xcode Setup Guide

## What you need
- A Mac running macOS 13 or later
- Xcode 15+ (free on the Mac App Store)
- An Apple Developer account (free for testing on your own device; $99/year for App Store)

---

## Step 1 — Clone the repo onto your Mac

Open Terminal and run:

```bash
git clone https://github.com/freshstartremovaltampa-cell/FreshStart-website.git
cd FreshStart-website
```

---

## Step 2 — Create a new Xcode project

1. Open **Xcode** → File → New → Project
2. Choose **iOS → App** → Next
3. Fill in:
   - **Product Name:** `FreshStart`
   - **Organization Identifier:** `com.freshstarttampa` (or your own)
   - **Interface:** SwiftUI
   - **Language:** Swift
   - Uncheck "Include Tests" for now
4. Click Next → **save it inside the cloned repo folder**
   (Xcode will create `FreshStart.xcodeproj` there)

---

## Step 3 — Add the Swift source files

In Xcode's left sidebar (Project Navigator):

1. **Delete** the placeholder files Xcode generated:
   - `ContentView.swift`
   - `FreshStartApp.swift` (Xcode's version — you'll use ours)

2. **Drag** these folders from the cloned repo into the Project Navigator:
   - `Models/`
   - `ViewModels/`
   - `Views/`
   - `FreshStartApp.swift`

3. When the dialog appears, make sure **"Copy items if needed"** is checked and the app target is ticked → Finish.

---

## Step 4 — Replace Info.plist entries

1. Select your project in the sidebar → your app **Target** → **Info** tab
2. Add these two keys (click **+** on any row):

| Key | Value |
|---|---|
| Privacy - Photo Library Usage Description | FreshStart needs access to your photos so you can share pictures of your items for an accurate quote. |
| Privacy - Camera Usage Description | FreshStart lets you take photos of your items directly for a faster quote. |

---

## Step 5 — Add Firebase (optional — needed for real data)

### 5a — Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Add a new project → name it **FreshStart**
3. Add an **iOS app** → enter your Bundle ID (e.g. `com.freshstarttampa`)
4. Download **`GoogleService-Info.plist`** and drag it into your Xcode project root

### 5b — Add the Firebase SDK via Swift Package Manager
In Xcode: File → Add Package Dependencies → paste this URL:

```
https://github.com/firebase/firebase-ios-sdk
```

Select these packages:
- `FirebaseFirestore`
- `FirebaseStorage`
- `FirebaseAuth` (optional, for login)

### 5c — Uncomment the Firebase code
Open these two files and uncomment the marked lines:

- `FreshStartApp.swift` — `import FirebaseCore` and `FirebaseApp.configure()`
- `ViewModels/AppointmentViewModel.swift` — all `// Firestore:` and `// Firebase Storage:` lines, then delete the placeholder code below each

---

## Step 6 — Build and run

1. Plug in your iPhone **or** choose an iPhone simulator from the toolbar
2. Press **⌘R** (or the ▶ Play button)
3. The first time you run on a real device, go to:
   **Settings → General → VPN & Device Management → [your Apple ID] → Trust**

That's it — the app will launch showing the dashboard with sample appointments.

---

## File structure reference

```
FreshStart-website/
├── FreshStartApp.swift          ← App entry point (@main)
├── Info.plist                   ← Privacy keys live here
├── Assets.xcassets/             ← App icon + accent color
├── Models/
│   └── Appointment.swift        ← Data model
├── ViewModels/
│   └── AppointmentViewModel.swift ← Firebase logic
└── Views/
    ├── MainDashboardView.swift  ← Home screen (today + upcoming jobs)
    ├── AppointmentBookingView.swift ← Booking form with photo picker
    └── ComponentViews/
        ├── PhotoGridView.swift  ← Reusable photo thumbnail grid
        └── PrimaryButton.swift  ← Reusable button + status badge
```
