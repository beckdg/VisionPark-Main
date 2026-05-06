VisionPark Frontend

VisionPark is a premium, AI-powered parking management system interface that offers distinct, tailor-made experiences to drivers, lot owners, and parking attendants. This React-based frontend dynamically routes users to feature-rich dashboards catering to spot reservation, real-time operational monitoring, and business analytics.

---

🛠️ Tech Stack
* React (v19.2.0) utilizing `useState` and `useEffect` hooks
* React DOM (v19.2.0)
* React Router DOM (v7.13.1) for navigation and programmatic redirects
* Tailwind CSS (v3.4.19)
* Vite (v7.3.1)
* Lucide React (v0.575.0) for icons
* Leaflet & React-Leaflet (v1.9.4 & v5.0.0) for interactive maps
* Radix UI components, clsx, tailwind-merge, and tailwindcss-animate for styling and UI primitives
* next-themes (v0.4.6) for dark/light mode context

---

📂 Full Project Structure

```text
src/
├── App.css                                     - Basic global and fallback CSS styles
├── App.jsx                                     - Main application routing (Domain checking & layout rendering)
├── index.css                                   - Tailwind directives and comprehensive design system styling
├── main.jsx                                    - React mounting point and context provider wrapping
├── admin/
│   ├── components/
│   │   └── AdminLayout.jsx                     - Shell layout and sidebar for the Admin module
│   └── pages/
│       ├── AdminProfile.jsx                    - Preferences and settings for the admin
│       ├── AlertThresholds.jsx                 - Configuration for system alert triggers
│       ├── AuditLog.jsx                        - Comprehensive log of system activity and user actions
│       ├── BackupRecovery.jsx                  - Interface for data backups and restoration
│       ├── Dashboard.jsx                       - High-level overview of platform status and metrics
│       ├── NetworkHealth.jsx                   - Monitoring of system node connectivity and latency
│       ├── OwnerAccount.jsx                    - Management interface for platform owners
│       ├── PaymentGateway.jsx                  - Configuration for external payment integrations
│       ├── PlatformAnalytics.jsx               - Cross-system data visualizations and reporting
│       ├── SessionManager.jsx                  - Overview and control of active user sessions
│       └── SystemConfig.jsx                    - Master settings for the VisionPark platform
├── assets/
│   └── react.svg                               - Default React vector graphic
├── attendant/
│   ├── components/
│   │   └── AttendantLayout.jsx                 - Shell layout and sidebar for the Attendant module
│   └── pages/
│       ├── AIExceptions.jsx                    - Interface for resolving AI detection anomalies
│       ├── AttendantProfile.jsx                - Preferences and settings for the attendant
│       ├── Enforcement.jsx                     - Tools for issuing citations or logging violations
│       ├── Incidents.jsx                       - Feed for logging and responding to facility incidents
│       ├── LiveGrid.jsx                        - Real-time status map of the parking floor
│       ├── Overstays.jsx                       - Tracking interface for vehicles exceeding reserved times
│       ├── WalkUpPOS.jsx                       - Point of sale terminal for unreserved drive-in customers
│       └── ZReport.jsx                         - End of shift financial reconciliation and reporting
├── components/
│   ├── layout/
│   │   ├── AdminHeader.jsx                     - Top navigation overlay used in admin domains
│   │   └── Header.jsx                          - Top navigation overlay used in standard pages and auth
│   ├── theme-provider.jsx                      - System-wide Next-themes provider wrapper
│   └── ui/
│       ├── GlassCard.jsx                       - Premium glassmorphism container component
│       ├── Logo.jsx                            - App logo rendering component
│       ├── StatusBadge.jsx                     - UI pill for displaying activity or condition states
│       ├── button.jsx                          - Reusable Radix/Tailwind button widget
│       ├── card.jsx                            - Reusable Radix/Tailwind structured card element
│       ├── input.jsx                           - Reusable styled input widget
│       ├── label.jsx                           - Reusable styled form label
│       └── theme-toggle.jsx                    - Light/Dark mode toggling switch
├── context/
│   ├── ScrollContext.jsx                       - Context provider managing unified scroller or positioning
│   └── ThemeContext.jsx                        - System-wide light/dark mode state manager
├── driver/
│   ├── components/
│   │   ├── DriverLayout.jsx                    - Main responsive layout wrapper for driver user domains
│   │   └── session/
│   │       └── ProgressRing.jsx                - SVG circular progress timer indicator for parking sessions
│   ├── context/
│   │   └── ScrollContext.jsx                   - Driver specific localized scroll context
│   └── pages/
│       ├── ActiveSession.jsx                   - Live tracking screen for an ongoing reserved parking spot
│       ├── DriverHistory.jsx                   - Interactive timeline feed of a driver's past parking usage
│       ├── DriverMap.jsx                       - Web map for locating branches, zones, and picking specific spots
│       └── DriverProfile.jsx                   - Preferences screen for managing driver and vehicle data
├── guest/
│   └── pages/
│       └── GuestMap.jsx                        - Public interactive map for anonymous users discovering parking spots
├── lib/
│   └── utils.js                                - Shared helpers like Tailwind class merging (cn)
├── owner/
│   ├── components/
│   │   └── OwnerLayout.jsx                     - Sophisticated dashboard layout for parking lot administrators
│   └── pages/
│       ├── Analytics.jsx                       - Advanced charts indicating utilization trends and traffic
│       ├── AttendantManagement.jsx             - Admin module for adding, firing, and reviewing employees
│       ├── Dashboard.jsx                       - General operational summary view for owners
│       ├── FinancialReports.jsx                - Comprehensive revenue metrics, ledgers, and transaction tables
│       ├── Operations.jsx                      - Command center for live camera feeds and real-time AI incident alerts
│       ├── OwnerProfile.jsx                    - Organization and individual settings for the lot owner
│       ├── ParkingManagement.jsx               - Builder for zones, grids, and individual spot definition
│       ├── PayoutSettings.jsx                  - Interface connecting withdrawal endpoints (banks, Telebirr)
│       └── PricingSettings.jsx                 - Management of hourly rates, tiers, and overstay multipliers
└── shared/
    ├── auth/
    │   ├── admin/
    │   │   ├── AdminForgotPassword.jsx         - Recovery flow for admin credentials
    │   │   └── AdminLogin.jsx                  - Secure authentication gateway for platform administrators
    │   ├── DriverSignUp.jsx                    - Multi-step registration for new platform drivers
    │   ├── ForgotPassword.jsx                  - Flow for fetching and resetting user credential access
    │   └── Login.jsx                           - Central identity gateway branching all user types
    └── pages/
        └── PrivacyPolicy.jsx                   - Standard generic display of legal data privacy terms
````

-----

## 💾 LocalStorage Reference Table

| Key | What it Stores | Read/Write Pages |
| :--- | :--- | :--- |
| `vp_theme` | "light", "dark", or "system" | **Write**: `ThemeContext.jsx`<br>**Read**: `Login`, `DriverSignUp`, `ForgotPassword`, `PrivacyPolicy` |
| `vp_driver_name` | Driver's Full Name | **Write**: `DriverSignUp.jsx`, `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx` |
| `vp_driver_email` | Driver's Email Address | **Write**: `DriverSignUp.jsx`, `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx` |
| `vp_driver_phone` | Driver's Phone Number | **Write**: `DriverSignUp.jsx`, `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx` |
| `vp_driver_vehicle` | Selected Vehicle Category | **Write**: `DriverSignUp.jsx`, `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx`, `DriverMap.jsx` |
| `vp_driver_license_plate` | Vehicle Plate String | **Write**: `DriverSignUp.jsx`, `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx` |
| `vp_driver_payment` | Chosen Payment Method | **Write**: `DriverProfile.jsx`, `DriverMap.jsx`<br>**Read**: `DriverProfile.jsx`, `DriverMap.jsx`, `ActiveSession.jsx` |
| `vp_driver_account` | Target payment account \# | **Write**: `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx` |
| `vp_driver_photo` | Profile picture Base64 string | **Write**: `DriverProfile.jsx`<br>**Read**: `DriverProfile.jsx` |
| `vp_session_state` | Session condition (e.g. "Reserved") | **Write**: `DriverMap.jsx`<br>**Read**: `ActiveSession.jsx` |
| `vp_selected_area` | JSON configuration of chosen branch | **Write**: `DriverMap.jsx`<br>**Read**: `ActiveSession.jsx` |
| `vp_selected_spot` | JSON details of specifically booked spot | **Write**: `DriverMap.jsx`<br>**Read**: `ActiveSession.jsx` |
| `vp_session_end_time` | Timestamp string of active session expiry | **Write**: `DriverMap.jsx`<br>**Read**: `ActiveSession.jsx` |
| `vp_session_start_time` | Timestamp string of session initialization | **Write**: `DriverMap.jsx`<br>**Read**: `ActiveSession.jsx` |
| `vp_payment_timestamp` | Timestamp string of exact payment time | **Write**: `DriverMap.jsx`<br>**Read**: `ActiveSession.jsx` |
| `vp_owner_data` | Object containing Owner details | **Write**: `OwnerProfile.jsx`, `OwnerAccount.jsx`<br>**Read**: `OwnerLayout.jsx`, `OwnerAccount.jsx` |
| `vp_owner_incidents` | Array of logged incidents (Property Damage/Disputes) | **Write**: `IncidentLogger.jsx`<br>**Read**: `Operations.jsx` |
| `vp_debt_radar` | Array of financial threats (Fleeing/Unpaid Debt) | **Write**: `IncidentLogger.jsx`, `DebtEnforcement.jsx`<br>**Read**: `Operations.jsx`, `DebtEnforcement.jsx` |

*(Note: Custom DOM events like `vp_profile_updated`, `vp_photo_updated`, and `vp_session_changed` are dynamically dispatched across Windows to refresh views).*

-----

## 🚗 Driver Module

### DriverMap — `src/driver/pages/DriverMap.jsx`

**Primary Purpose:** The core interactive explorer for drivers to visually locate parking facilities, verify vehicle compatibility, and reserve individual spots immediately with integrated mock payment.

**Key Features & Mechanics:**

  * **Precision Geospatial Routing:** Calculates exact distance using the Haversine formula and forces a fresh GPS lock (`maximumAge: 0`) to accurately route the driver.
  * **Complex State Handoffs:** Smoothly transitions between contextual layers (Map -\> Lot Selection -\> Spot Selection -\> Payment Confirmation -\> Payment Success) without hard reloads. Synchronizes reservation data to `localStorage`.
  * **Vehicle Compatibility Guard:** Cross-references the driver's registered vehicle type against spot dimensions, graying out incompatible spots with an alert badge.
  * **Native HTML5 Dialogs:** Overlays (Region Selector, External Handoff Warning) use the native `#top-layer` API to prevent clipping under Leaflet's z-index.
  * **Strict Render Isolation:** The map is heavily memoized so that interacting with the horizontal swipe carousel does not cause map tiles to stutter or re-render.

### ActiveSession — `src/driver/pages/ActiveSession.jsx`

**Primary Purpose:** A digital ticket and dynamic state-machine timer tracking the driver's session through three phases: Reserved, Secured, and System Receipt.

**Key Features & Mechanics:**

  * **State-Machine via `localStorage`:** Relies on raw timestamps (`vp_session_start_time`, `vp_session_end_time`) stored locally to mathematically calculate duration, ensuring accuracy even if the app is closed.
  * **Background OS Notifications:** Uses a "5-Second Catch Window" and a `useRef` `Set` to reliably trigger native OS push notifications (5m, 3m, 2m, 1m warnings) even when browser JavaScript timers are throttled in the background. Notifications only fire if the user is outside the app (`document.hidden` is true).
  * **Live Pricing Algorithm:** Dynamically calculates cost during the "Secured" phase based on business rules (1 ETB/min, minimum 10 ETB charge).

### DriverHistory — `src/driver/pages/DriverHistory.jsx`

**Primary Purpose:** The consumer's personal financial ledger, providing transparency regarding past sessions, costs, penalty enforcements, and digital receipts.

**Key Features & Mechanics:**

  * **"This Month" Aggregator:** A summary card calculating total spend and total time parked for the current month, along with determining the driver's "Favorite Lot".
  * **Digital Receipt Modal:** Provides immutable cryptographic proof of payment, displaying granular timestamps, exact financial breakdowns, and verification of the Chapa integration. Includes a simulated E-Receipt download workflow.
  * **Persistent Navigation:** Incorporates a "Navigate to Lot" button that instantly boots up Google Maps for returning to obscure locations.

### DriverProfile — `src/driver/pages/DriverProfile.jsx`

**Primary Purpose:** The operational anchor securely housing payment preferences, digital wallet balance, and the "Vehicle DNA" used by YOLOv8 cameras for identification.

**Key Features & Mechanics:**

  * **Live WebRTC Avatar Capture:** Allows users to take a live selfie using a custom, immersive WebRTC camera interface or upload an image from their gallery.
  * **Dynamic Vehicle DNA Capture:** Modifies input rules based on License Type (e.g., locking "Private" to 6-7 numeric digits, allowing alphanumeric for "Diplomatic") and utilizes custom bottom-sheet selectors.
  * **Frictionless Validation:** Actively hunts for common email typos (e.g., `gmai.com`) and strictly enforces Ethiopian phone logic (09, 07, +251) with real-time feedback.

-----

## 🏢 Owner Module

### Dashboard — `src/owner/pages/Dashboard.jsx`

**Primary Purpose:** The operational heart answering "What is happening right now?" by providing a live, birds-eye view of capacity, active customers, and today's ticking revenue.

**Key Features & Mechanics:**

  * **Smart Cascading Filters:** A global funnel (Region -\> City -\> Branch) that instantly recalculates all metrics, charts, and tables to reflect the specific selected scope.
  * **Live Visual Analytics:** Features a Donut Chart for parking occupancy and a Bar Chart tracking revenue velocity throughout the day.
  * **Recent Activity Ledger:** A real-time, scrolling feed generated by AI cameras and attendants, acting as the absolute "ground truth" for vehicle entry/exit times.

### ParkingManagement — `src/owner/pages/ParkingManagement.jsx`

**Primary Purpose:** The architectural foundation allowing owners to seamlessly digitize their physical lots by structuring locations into a strict hierarchy (Branch -\> Zone -\> Spot).

**Key Features & Mechanics:**

  * **Visual Parking Grid:** An interactive digital map where every spot is visually color-coded based on status. Hovering provides a premium floating portal with spot details and restrictions.
  * **Smart Grid Generator:** Automates bulk creation of up to 500 spots using custom steppers, alphanumeric translation logic (Row 1=A), and prefixing (e.g., VIP-A1), safely skipping duplicate IDs.
  * **Premium Input Controls:** Utilizes custom-engineered interfaces, such as smart time pickers and dynamic modal overlays, instead of standard web forms.

### AttendantManagement — `src/owner/pages/AttendantManagement.jsx`

**Primary Purpose:** The central HR and access control hub for securely registering staff, assigning physical locations, and generating cryptographic credentials.

**Key Features & Mechanics:**

  * **Registered Workforce Roster:** Displays active personnel, their Fayda ID, assigned branch, and current shift schedule, with quick-action tools for password resets or access revocation.
  * **Secure Registration Workflow:** Enforces strict 16-digit formatting for Fayda IDs and valid Ethiopian mobile formats.
  * **Cryptographic Credential Generation:** Auto-generates secure, randomized 12-character alphanumeric passwords with live security validation.

### Operations — `src/owner/pages/Operations.jsx`

**Primary Purpose:** The high-level command center monitoring the entire network, providing live overviews of camera hardware, system alerts, and a consolidated feed of incidents.

**Key Features & Mechanics:**

  * **Dual Data Stream Aggregation:** Intelligently merges static mock data with dynamic local storage payloads from `vp_owner_incidents` and `vp_debt_radar`, normalizing the differing schemas.
  * **Defensive Deduplication:** Uses a strict JavaScript `Map` object during data loading to silently drop duplicate `id` entries, mathematically preventing React rendering crashes.
  * **Edge Media Simulation:** Features an HTML5 Evidence Modal that renders Base64 media strings or intelligently simulates an "Edge Node Retrieval" fallback if the file exceeds the 1.5MB safeguard.

### Analytics — `src/owner/pages/Analytics.jsx`

**Primary Purpose:** Aggregates thousands of data points to reveal long-term infrastructure usage patterns, providing strategic intelligence for pricing and expansion.

**Key Features & Mechanics:**

  * **Utilization Intelligence:** Visualizes capacity fill-rates via a 24-hour Area Chart and identifies recurring bottlenecks using a weekly Occupancy Heatmap.
  * **Operational Behavior:** Highlights peak volume hours (Bar Chart) and tracks the average parking duration and turnover rate per spot.
  * **Infrastructure Insights:** Progress bars display specific internal zone performance, while a Donut Chart breaks down the vehicle category distribution.

### FinancialReports — `src/owner/pages/FinancialReports.jsx`

**Primary Purpose:** A comprehensive financial analytics interface tracking parking revenue, platform fees, payment method distributions, and dynamic revenue trends.

**Key Features & Mechanics:**

  * **Hierarchical Location Filters:** Strict top-down cascading selection ensuring users only pick valid child locations. Uses custom full-screen backdrop modals to avoid native `<select>` limitations.
  * **Interactive Charts:** Features an AreaChart with a custom SVG gradient for revenue trends (switchable between Daily, Weekly, Monthly) and a Donut Chart for payment method breakdowns. Uses custom dark-mode optimized tooltips.
  * **Key Performance Indicators:** Distinctly separates "Gross Revenue" from "Net Earnings" highlighting the amount ready for withdrawal.

### PricingSettings — `src/owner/pages/PricingSettings.jsx`

**Primary Purpose:** The core revenue engine allowing granular configuration of base rates (ETB/Hr) per specific physical location and exact vehicle type, alongside overstay penalty logic.

**Key Features & Mechanics:**

  * **Hierarchical Rate Matrix:** A massive data table grouping vehicles by official taxonomy (e.g., Public Transport, Machineries). Inputting a Base Rate instantly calculates and displays the Overstay Rate preview.
  * **Overstay Penalty Engine:** Uses a global multiplier (e.g., 1.85x) with a dynamic "Example Scenario" card that automatically calculates a mock session to visualize the final impact on the driver's bill.
  * **Custom Number Steppers:** Replaces native browser input arrows with custom, oversized Chevron buttons for precise control.

### PayoutSettings — `src/owner/pages/PayoutSettings.jsx`

**Primary Purpose:** The bridge to the owner's actual bank account, seamlessly integrating with Chapa's payout ecosystem to link preferred Ethiopian banks and mobile wallets.

**Key Features & Mechanics:**

  * **Liquidity Tracking:** Displays "Ready for Withdrawal" funds with the automated payout schedule, and explicitly tracks "Processing / In Transit" funds to prevent owner panic.
  * **Dynamic Linking Workflow:** Context-aware smart forms adapt input requirements based on the provider (e.g., requiring an Account Number for CBE vs. an Ethio Telecom formatted Mobile Number for Telebirr). Includes identity security (KYC) warnings.
  * **Smart Routing:** Allows owners to designate a "Primary" account for automatic weekly routing, utilizing visual security to mask account numbers. Features fallback logic that promotes the next verified account if the primary is deleted.

### OwnerProfile — `src/owner/pages/OwnerProfile.jsx`

**Primary Purpose:** A settings interface for managing personal identity, business details, security credentials, and system notification preferences.

**Key Features & Mechanics:**

  * **Global Synchronization:** When changes are saved, the function `saveToLocalAndDispatch` writes to `localStorage` and dispatches a `vp_owner_profile_updated` CustomEvent. The `OwnerLayout` catches this, instantly updating the header and sidebar avatars across the app without a reload.
  * **WebRTC & Base64 Avatar Management:** Accesses the webcam via `navigator.mediaDevices.getUserMedia`, draws the frame to a hidden `<canvas>`, and saves the Base64 string directly to ensure persistence across reloads. Features a mirrored camera modal with a framing guide.
  * **Password Utilities:** Includes independent visibility toggles, an auto-generator for secure 12-character passwords, and a real-time strength meter evaluating 5 criteria.

-----

## 👮 Attendant Module

### LiveGrid — `src/attendant/pages/LiveGrid.jsx`

**Primary Purpose:** The critical "human-in-the-loop" dashboard providing a real-time, color-coded visual map of the physical parking lot for dispute resolution and anomaly spotting.

**Key Features & Mechanics:**

  * **Color-Coded Status Engine:** Spots instantly reflect their AI-detected state (Free, Reserved, Occupied, or Squatter Conflict) on a fluid, auto-scaling grid.
  * **Squatter Conflict Resolution:** Automated flagging flashes a spot purple if an unauthorized plate occupies a reserved space. Attendants can initiate a "De-escalation Workflow" logging physical intervention.
  * **Live Edge AI Telemetry:** Clicking an occupied spot simulates a direct IP camera feed overlaying the YOLOv8 bounding box, live classification, and exact confidence score.

### AIExceptions — `src/attendant/pages/AIExceptions.jsx`

**Primary Purpose:** The ultimate failsafe for automated enforcement, immediately routing AI inference failures (due to mud, glare, rain) to the attendant for human correction and database force-syncing.

**Key Features & Mechanics:**

  * **Triage Queue:** Categorizes failures into high-contrast tags like `UNREADABLE_PLATE`, `EXIT_MISMATCH`, or `CATEGORY_MISMATCH`.
  * **Human Override Desk:** A split-screen modal displaying the camera snapshot with the AI's "Best Guess" bounding box alongside dynamic resolution forms that adapt to the specific exception type.
  * **Frictionless System Sync:** Enforces strict inline validation before allowing the attendant to "Force Update & Resolve," instantly overwriting the faulty record.

### WalkUpPOS — `src/attendant/pages/WalkUpPOS.jsx`

**Primary Purpose:** A lightning-fast, tablet-optimized digital cash desk eliminating paper tickets by generating verifiable digital ledgers and E-Receipts for unregistered drive-in customers.

**Key Features & Mechanics:**

  * **Terminal Engine:** Context-aware forms instantly adapt validation rules based on plate type (e.g., "Diplomatic" accepts letters). Incorporates an internal matrix to instantly calculate totals based on duration and vehicle class.
  * **Smart Time Controls:** Replaces manual typing with massive, high-contrast increment buttons that logically roll over (e.g., adding past 55 minutes resets to 0 and adds an hour).
  * **E-Receipt Ecosystem:** Generates a scannable QR code on-screen, encouraging drivers to photograph the tablet, with native integrations for WhatsApp/Telegram delivery and Bluetooth thermal printer fallback.

### Overstays — `src/attendant/pages/Overstays.jsx`

**Primary Purpose:** A "Hit-List" that automatically isolates and highlights every vehicle violating prepay durations or abandoning vehicles overnight, empowering the attendant to enforce physical clamping.

**Key Features & Mechanics:**

  * **Instant Triage HUD:** Displays Active Targets, Clamped Vehicles, and recalculates the Total Uncollected Fines in real-time, explicitly separating "Base Debt" from "Rule Violation Penalties".
  * **Visual Categorization:** Color-codes severity levels (Walk-Up Overstay vs. Overnight/Abandoned).
  * **Enforcement Workflow:** Clicking "Confirm Clamp" officially registers the vehicle as immobilized, updating the UI with an Amber lock icon and signaling the exit cameras. Reverses via a "Collect Fine & Unclamp" resolution flow.

### IncidentLogger — `src/attendant/pages/IncidentLogger.jsx`

**Primary Purpose:** A structured, fail-safe interface for logging anomalies, property damage, and fleeing vehicles. Captures rich data at the edge and securely routes it to the Owner or Global Debt Radar.

**Key Features & Mechanics:**

  * **Intelligent Event Routing:** Uses helper functions (`pushToOwnerIncidents`, `pushToDebtRadar`) to dispatch standard incidents for human review, inject "Fled Without Payment" into the global watchlist, and elevate `UNKNOWN` plates to "Admin CCTV Review Needed".
  * **Memory Safeguards & Base64 Encoding:** Implements a strict 1.5MB file size limit when converting `.mp4` or `.jpg` files via the asynchronous `FileReader` API. Large files trigger a fallback `"MOCK_FILE_TOO_LARGE"` reference to prevent `localStorage` crashes.
  * **Dynamic Form Validation:** Adapts fields based on incident type (e.g., dynamic input arrays for Damaged Vehicles) and blocks submission if contextual requirements (like an unpaid amount for fleeing vehicles) are missing.

### DebtEnforcement — `src/attendant/pages/DebtEnforcement.jsx`

**Primary Purpose:** A high-security operational dashboard tracking and resolving historic unpaid debts. Connects with the incident reporting loop to flag problematic vehicles the moment they enter a lot.

**Key Features & Mechanics:**

  * **Dynamic Data Synchronization:** Listens to the `vp_debt_radar` array and normalizes the schema mapping payloads from the `IncidentLogger` into the unified Debt Radar format.
  * **React Stability via Key Deduplication:** To prevent catastrophic rendering errors when merging mock and live data, a strict JavaScript `Map` (`uniqueDebtsMap`) drops duplicate entries to mathematically guarantee unique keys.
  * **Persistent Action States:** Executing a "Clamp" writes deeply into `localStorage`, locking out exit buttons and applying amber styling, ensuring the clamp status survives page refreshes.

### ZReport — `src/attendant/pages/ZReport.jsx`

**Primary Purpose:** Manages the entire shift lifecycle using a highly secure "Blind Close" mechanism to prevent skimming, enforce cash accountability, and sync shift variances to the Owner's ledger.

**Key Features & Mechanics:**

  * **Blind Close Security Protocol:** Intentionally hides the system's expected cash total during the end-of-shift close. Attendants are forced to physically count and enter their raw drawer holdings, preventing them from "making the math work".
  * **Automated Variance Generation:** Cross-references the entered physical cash against the digital ledger to instantly generate a color-coded Z-Report indicating an EXACT MATCH, OVERAGE, or SHORTAGE.
  * **Session Cash Ledger:** Maintains an immutable, rolling feed of every cash transaction during the shift to assist the attendant with mental audits prior to submission.

### AttendantProfile — `src/attendant/pages/AttendantProfile.jsx`

**Primary Purpose:** A strictly read-only digital ID card serving as the attendant's operational "source of truth," preventing unauthorized shift changes or credential manipulation by the employee.

**Key Features & Mechanics:**

  * **Immutable Personal Identity:** Every data point (Fayda ID, Email) is secured behind locked visual inputs. Enforces a rigorous, un-abbreviated hierarchical format for physical addresses.
  * **Active Assignment Dashboard:** Features a premium Emerald Shift Card dictating the exact branch assignment and scheduled shift window, eliminating ambiguity regarding expected hours.
  * **Security Protocol:** Centralizes credential management to the Owner. A "Request Profile Update" workflow directs attendants to route password resets or phone number changes through their manager.

-----

## 💻 System Admin Module

### SystemConfig — `src/admin/pages/SystemConfig.jsx`

**Primary Purpose:** A global settings dashboard centralizing environment toggles, AI engine parameters, database/cloud credentials, and API rate limits.

**Key Features & Mechanics:**

  * **Diagnostic Simulations:** Features a "System Diagnostics" suite. Uses `handleTestDb` to ping a defined URL and `runHealthCheck` for a batch diagnostic sweep across critical components like YOLOv8 and FastAPI.
  * **Environment Safety:** Intercepting a transition to the "Production" environment halts the change and triggers a danger modal to ensure the admin is aware of live-traffic implications. Activates a red border warning (`isDangerZone`).
  * **Computed Data Badging:** Dynamically compares the active `config` against `savedConfig` to calculate `unsavedChangesCount`, driving the visibility of the "Unsaved" header badge.

### AdminProfile — `src/admin/pages/AdminProfile.jsx`

**Primary Purpose:** A comprehensive identity and security management interface centralizing personal profile editing, 2FA setup, and session revocation.

**Key Features & Mechanics:**

  * **Cursor-Preserving Password Toggle:** Utilizes `requestAnimationFrame` to wait for React's DOM flush before programmatically restoring the exact text selection range, preventing the cursor from snapping to the end when toggling password visibility.
  * **Sequential Terminate All Simulation:** Iterates over the `otherSessions` array, removing active devices one by one to simulate realistic, sequential API network calls for session revocation.
  * **System Access Log:** A sticky-header table displaying a mock audit trail of recent administrative actions alongside a highly stylized Danger Zone for factory resets.

### SessionManager — `src/admin/pages/SessionManager.jsx`

**Primary Purpose:** A critical tool to monitor, evaluate, and forcefully terminate active user sessions across all roles. Features a dedicated panel that automatically flags high-risk activities.

**Key Features & Mechanics:**

  * **Computed Filtering (`useMemo`):** Efficiently recalculates the session array by applying location filters (via reverse-lookup maps), text searches, role filters, and sorting criteria.
  * **Session Termination Execution:** Uses a two-step inline verification ("Terminate" -\> "Confirm Kill"). Confirmed sessions are added to a `terminatingIds` array to trigger an outgoing CSS animation before being permanently removed from the state.
  * **Suspicious Activity Panel:** A persistent sidebar highlighting sessions flagged as suspicious. Admins can expand cards to reveal detailed telemetry (IP, Duration) and execute immediate kills.

### AuditLog — `src/admin/pages/AuditLog.jsx`

**Primary Purpose:** The immutable system of record presenting a paginated, highly filterable table of all system events. Allows deep drill-downs into complex JSON technical payloads.

**Key Features & Mechanics:**

  * **Multi-Filter Integration:** The `filteredLogs` array utilizes `useMemo` to simultaneously apply Search queries, Actor/Category Dropdowns, Date Match logic, and specialized Vehicle Category filters.
  * **Event Detail Drawer:** Clicking a row slides in a detailed receipt. If the metadata payload contains before/after states, it renders them as side-by-side formatted JSON code blocks (Gray for Previous, Indigo for New).
  * **Specialized Vehicle Filter Modal:** Renders `VEHICLE_CATEGORY_GROUPS` in a full-screen modal, triggering a removable "pill" badge when a vehicle filter is active.

### Dashboard — `src/admin/pages/Dashboard.jsx`

**Primary Purpose:** The central command center providing a real-time, high-level overview of infrastructure health, edge node telemetry, and system-wide events.

**Key Features & Mechanics:**

  * **Hierarchical Smart Filter:** Allows administrators to drill down from a national view to specific parking branches, dynamically updating all KPIs, AreaCharts, and tables via `useMemo`.
  * **Dynamic Alerting:** Features a "Critical Alerts" KPI card that turns red and pulsates if offline or warning nodes exist within the currently filtered scope.
  * **Custom Tooltips & Overlays:** Implements dark-mode optimized Recharts tooltips and uses full-screen backdrop modals for dropdown options to bypass native `<select>` styling limitations.

### PlatformAnalytics — `src/admin/pages/PlatformAnalytics.jsx`

**Primary Purpose:** A sophisticated data visualization dashboard tailored for analyzing AI infrastructure telemetry, including YOLOv8 inference times, OCR accuracy, and CPU utilization.

**Key Features & Mechanics:**

  * **Computed Chart Rendering:** Deeply memoizes (`useMemo`) complex data objects for Bar, Line, and Donut charts. Dynamically adjusts data volume based on location filters (`volMultiplier`) and the active time range (e.g., 7 for "7D").
  * **Smart Auto-Fill Logic:** If a selected Region only contains one valid City (e.g., Dire Dawa), the `handleRegionSelect` automatically cascades the selection down to the specific Lot level.
  * **Export Simulation:** Generates a mock CSV string based on current `kpiStats` and filters, creates a temporary Blob URL, and forces a browser download.

### NetworkHealth — `src/admin/pages/NetworkHealth.jsx`

**Primary Purpose:** A critical diagnostic tool to monitor real-time physical Edge AI node status on an interactive geographic map and actionable ledger.

**Key Features & Mechanics:**

  * **Interactive React-Leaflet Map:** The `MapCamera` triggers a smooth `map.setView()` pan/zoom animation. The map uses `React.memo` and dynamic z-indexing to keep selected nodes visible above clusters. Custom HTML icons provide pulsing distress beacons for offline nodes.
  * **Node Detail Card Portal:** When a node is selected, its diagnostic card uses `ReactDOM.createPortal` to render directly into `document.body`, preventing Leaflet's `overflow-hidden` constraints from clipping the UI.
  * **Action State Dictionaries:** Manages loading feedback specifically mapped by `nodeId` (`repollState`, `snapshotState`, `maintainState`), providing isolated button spinners without locking the entire UI during simulated API requests.

### OwnerAccount — `src/admin/pages/OwnerAccount.jsx`

**Primary Purpose:** An exclusive interface to manage the single "VisionPark Operator" account, toggling between an "Initialization Mode" for setup and a "Management Mode" for administration.

**Key Features & Mechanics:**

  * **Avatar Upload & State Transitions:** Reads files via `FileReader`, converting to Base64 strings. Safely shifts the component between read-only Management Mode and an editable form view depending on the `accountExists` flag.
  * **Smart Input Validation:** Typo-correction dictionaries catch invalid emails, while phone inputs strictly enforce Ethiopian prefixes (`+2519`, `+2517`) and length rules. Auto-generates secure 12-character passwords excluding confusing characters (O vs 0).
  * **Danger Zone Mechanics:** Includes a heavy red visual state for suspended accounts. Houses a destructive "Re-initialize Account" workflow that purges the `vp_owner_data` key from local storage.

### PaymentGateway — `src/admin/pages/PaymentGateway.jsx`

**Primary Purpose:** A centralized dashboard to monitor payment integrations (Telebirr, CBE), featuring real-time health charting, a failed transaction ledger, and a secure configuration modal for production API keys.

**Key Features & Mechanics:**

  * **Phone/Account Number Validation:** Strict formatting based on the selected institution: enforces Safaricom prefixes (07/+2517) for M-PESA, Ethio Telecom prefixes for Digital Wallets, and 13-digit maximums for standard banks.
  * **Gateway Status Cards:** Renders active providers with scaled transaction metrics and a health dot. Deactivated cards transition to grayscale.
  * **Webhook Configuration & Testing:** Allows admins to define endpoint URLs and Secrets. Clicking "Test" simulates an API ping, randomly resulting in HTTP 200 or HTTP 503 gateway timeouts to update the UI badge.

### BackupRecovery — `src/admin/pages/BackupRecovery.jsx`

**Primary Purpose:** An essential disaster recovery tool to monitor automated schedules, trigger manual system snapshots, and execute emergency rollbacks via a visual restoration engine.

**Key Features & Mechanics:**

  * **Rollback Simulation (`executeRestoreSimulation`):** Simulates a complex backend restoration with a randomized 15% failure rate. Progress updates pass an integer to `getRestoreMessage()` to dynamically update status text.
  * **Automated Validation Wizard:** The "System Restore Wizard" is a persistent 3-step form. Steps 2 and 3 remain visually disabled (opacity-40, grayscale) until the preceding step is verified and completed.
  * **File Downloads & Fallbacks:** Simulates downloading encrypted archives using the `Blob` API to generate a temporary `ObjectURL`. Includes a "Quick Restore" action directly inside the table that bypasses the side-panel wizard.

### AlertThresholds — `src/admin/pages/AlertThresholds.jsx`

**Primary Purpose:** An administrative interface to set and modify trigger criteria for automated system alerts across Node Health, AI Performance, Financial, and Security categories.

**Key Features & Mechanics:**

  * **Active Triggers Preview:** Dynamically compares the user's current draft changes against the live `MOCK_CURRENT_STATE`. If a draft threshold is exceeded, an alert card immediately renders in the preview panel before the admin hits "Save".
  * **Deep Merge Handlers:** Utilizes `handleThresholdChange` and `handleRoutingChange` to precisely update specific numerical limits, routing booleans, and webhook strings within deeply nested objects.
  * **Computed Evaluation:** A `hasUnsavedChanges` boolean compares the stringified draft states against the `DEFAULT` constants. This drives the pulsing "Unsaved" badge and enables the Save/Reset buttons.

### AdminLogin — `src/shared/auth/admin/AdminLogin.jsx`

**Primary Purpose:** A high-security, dual-purpose gateway strictly reserved for System Administrators. Uses a state-machine to handle both standard sign-in and a multi-step password recovery flow within a single component.

**Key Features & Mechanics:**

  * **State Machine Routing:** Bypasses URL routing for recovery steps in favor of flow modes (`login`, `fp-identity`, `fp-otp`, `fp-password`).
  * **Account Enumeration Mitigation:** Step 1 requires both the Admin Email and System Admin ID. The system returns a purposefully vague response if either field is incorrect to prevent bad actors from verifying valid emails.
  * **Strict Theme Override:** Forces the UI to match the browser's system preference (`prefers-color-scheme: dark`) using a `useEffect` hook, overriding any saved user theme to ensure a native backend experience.

### AdminForgotPassword — `src/shared/auth/admin/AdminForgotPassword.jsx`

**Primary Purpose:** The localized logic specifically driving the 4-step wizard interface handled by the `AdminLogin` component's state machine.

**Key Features & Mechanics:**

  * **Dual Identity Verification:** Enforces the requirement of the unique System Admin ID alongside the email to initiate the reset process.
  * **Strict Security Policies:** Admin OTPs are noted to expire in 30 minutes. Setting a new password strictly requires a score of 4 or higher from the 5-point password strength algorithm (`isPasswordStrong`).
  * **Admin Badging & Environment Context:** Utilizes the Indigo color scheme and distinct "System Administrator" badging to signal the privileged flow environment.

## 📑 Layouts

### AdminLayout — `src/admin/components/AdminLayout.jsx`

**Primary Purpose:** The global structural shell for the System Admin portal, providing a persistent sidebar, top header, and centralized toast notification system.

**Key Features & Mechanics:**

  * **Live Profile Synchronization:** Listens for the `vp_profile_updated` window event. When triggered by the `AdminProfile` page, it runs `readAdminProfile()` to instantly re-render the avatar and name in the header and sidebar without a reload.
  * **Context Provider:** Passes the `showToast` function down through the React Router `<Outlet context={{ showToast }} />`, giving all child pages unified access to the global notification portal.
  * **Collapsed Tooltip Engine:** Calculates the exact `rect.top` coordinate of hovered icons in the collapsed sidebar to accurately position floating tooltips via fixed CSS. Centralizes Toast rendering using `ReactDOM.createPortal`.

### OwnerLayout — `src/owner/components/OwnerLayout.jsx`

**Primary Purpose:** The structural shell for the VisionPark Owner Portal, featuring an Emerald color scheme to distinguish it from the Admin's Indigo theme while maintaining identical structural behaviors.

**Key Features & Mechanics:**

  * **Event Listeners:** Attaches listeners to `vp_owner_profile_updated` (owner edits) and `vp_owner_data_updated` (admin edits). Triggers `readOwnerProfile()` to instantly sync UI elements without a page refresh.
  * **Mobile Drawer Integration:** Renders the `SidebarContent` inside a fixed overlay with a blurred backdrop when `isMobileMenuOpen` is toggled.
  * **State Tracking:** Tracks `hoveredNav` coordinates and `owner.unreadNotifications` to drive tooltip positioning and the bell icon's pulsing red badge.

### AttendantLayout — `src/attendant/components/AttendantLayout.jsx`

**Primary Purpose:** The structural wrapper for operational staff. Built to be lean, fast, and aggressively responsive for handheld devices, themed in Emerald.

**Key Features & Mechanics:**

  * **Route Cleanup:** A `useEffect` hook ensures the mobile menu drawer closes and hover tooltips clear automatically whenever `location.pathname` changes.
  * **Flexible Workspace:** Houses the `<Outlet />` inside a `max-w-[1600px]` container, allowing the main `overflow-y-auto` tag to handle vertical scrolling independently from the sidebar.
  * **Real-time Readiness:** Includes mapped hooks prepared for WebSocket (`socket.on('new_alert')`) integration to dynamically increment `unreadCount`.

### DriverLayout — `src/driver/components/DriverLayout.jsx`

**Primary Purpose:** Strictly optimized for mobile viewports, serving as an app-like shell. Features a fixed bottom navigation bar, a global top header, and a non-scrollable central workspace.

**Key Features & Mechanics:**

  * **Notification Synchronization:** Acts as the single source of truth for notifications. Passes `unreadCount` to the Header prop, and exposes `setUnreadCount` via the Outlet context to deeply nested child pages.
  * **Viewport Management:** Enforces `overflow-hidden` at the layout level, explicitly delegating scrolling to individual child pages. This is critical for interactive maps that require strict non-scrolling bounding boxes on touch screens.
  * **ScrollContext Provider:** Wraps the entire layout to manage complex scroll states on mobile devices (e.g., hiding/showing navigation bars based on scroll direction). Uses `pb-safe` to respect safe-area insets on modern smartphones.

-----

## 🧩 Shared Components

  * **ProgressRing** (`src/driver/components/session/ProgressRing.jsx`): A circular, animated countdown timer leveraging native SVG elements. Calculates `strokeDashoffset` dynamically based on the remaining percentage to smoothly animate an emerald glow.
  * **Header**: Primary navigation context aware of user types. Features theme shifting, logo rendering, and profile toggling.
  * **GlassCard**: Foundational element standardizing visual consistency by embedding subtle transparency layers mirroring glassmorphism aesthetics.
  * **Logo**: Unified central vector display of the main corporate brand.
  * **StatusBadge**: Tiny pill indicators ensuring rapid cognition of varied dynamic conditions.
  * **Theme-Toggle**: Interactive utility strictly responsible for swapping light mode vs dark mode boolean identifiers in the DOM matrix context.

<!-- end list -->

