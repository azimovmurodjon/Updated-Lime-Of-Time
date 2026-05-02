import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";
import { dataDeletionRequests } from "../drizzle/schema";

// ─── Register Legal Routes ──────────────────────────────────────────

export function registerLegalRoutes(app: Express) {
  // ── Privacy Policy ─────────────────────────────────────────────────
  app.get("/api/legal/privacy", (_req: Request, res: Response) => {
    res.send(privacyPolicyPage());
  });

  // ── Terms of Service ───────────────────────────────────────────────
  app.get("/api/legal/terms", (_req: Request, res: Response) => {
    res.send(termsOfServicePage());
  });

  // ── End User License Agreement ─────────────────────────────────────
  app.get("/api/legal/eula", (_req: Request, res: Response) => {
    res.send(eulaPage());
  });

  // ── Business Owner Agreement ───────────────────────────────────────
  app.get("/api/legal/business-agreement", (_req: Request, res: Response) => {
    res.send(businessAgreementPage());
  });

  // ── Data Deletion Request (POST) ───────────────────────────────────
  app.post("/api/legal/data-deletion", async (req: Request, res: Response) => {
    try {
      const { email, phone, type, reason } = req.body;
      if (!email && !phone) {
        res.status(400).json({ error: "Email or phone is required" });
        return;
      }
      const dbase = await getDb();
      if (!dbase) {
        res.status(500).json({ error: "Service unavailable" });
        return;
      }
      await dbase.insert(dataDeletionRequests).values({
        email: email || "",
        phone: phone || "",
        requestType: type || "full",
        reason: reason || "",
        status: "pending",
      });
      res.json({ success: true, message: "Your data deletion request has been submitted. We will process it within 30 days." });
    } catch (err) {
      console.error("[Legal] Data deletion request error:", err);
      res.status(500).json({ error: "Failed to submit request" });
    }
  });

  // ── Data Deletion Request Page ─────────────────────────────────────
  app.get("/api/legal/data-deletion", (_req: Request, res: Response) => {
    res.send(dataDeletionPage());
  });
}

// ─── Shared Styles ──────────────────────────────────────────────────

function legalStyles(): string {
  return `
    <style>
      :root {
        --bg: #0f1117;
        --bg-card: #1a1d27;
        --border: #2a2d3a;
        --text: #e4e6eb;
        --text-muted: #8b8fa3;
        --primary: #4a8c3f;
        --primary-hover: #5aa34d;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.7;
        min-height: 100vh;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 24px;
      }
      .logo-header {
        text-align: center;
        margin-bottom: 40px;
      }
      .logo-header h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 4px;
      }
      .logo-header .subtitle {
        color: var(--text-muted);
        font-size: 14px;
      }
      h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
      h2 { font-size: 22px; font-weight: 600; margin: 32px 0 12px; color: var(--primary); }
      h3 { font-size: 18px; font-weight: 600; margin: 24px 0 8px; }
      p { margin-bottom: 16px; color: var(--text-muted); }
      ul, ol { margin: 0 0 16px 24px; color: var(--text-muted); }
      li { margin-bottom: 8px; }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }
      .effective-date {
        color: var(--text-muted);
        font-size: 14px;
        margin-bottom: 32px;
      }
      .card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
      }
      .back-link {
        display: inline-block;
        margin-bottom: 24px;
        color: var(--text-muted);
        font-size: 14px;
      }
      .back-link:hover { color: var(--primary); }
      .nav-links {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 40px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
      }
      .nav-links a {
        font-size: 14px;
        color: var(--text-muted);
      }
      /* Form styles for data deletion */
      .form-group { margin-bottom: 20px; }
      .form-group label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 6px;
        color: var(--text);
      }
      .form-group input, .form-group select, .form-group textarea {
        width: 100%;
        padding: 12px 16px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--text);
        font-size: 15px;
        font-family: inherit;
      }
      .form-group textarea { min-height: 100px; resize: vertical; }
      .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
        outline: none;
        border-color: var(--primary);
      }
      .btn-submit {
        display: inline-block;
        padding: 12px 32px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-submit:hover { background: #dc2626; }
      .success-msg {
        display: none;
        background: rgba(74, 140, 63, 0.15);
        border: 1px solid var(--primary);
        border-radius: 8px;
        padding: 16px;
        color: var(--primary);
        margin-top: 16px;
      }
      @media (max-width: 600px) {
        .container { padding: 24px 16px; }
        h1 { font-size: 24px; }
        h2 { font-size: 18px; }
      }
    </style>`;
}

function legalFooter(): string {
  return `
    <div class="nav-links">
      <a href="/api/legal/privacy">Privacy Policy</a>
      <a href="/api/legal/terms">Terms of Service</a>
      <a href="/api/legal/eula">EULA</a>
      <a href="/api/legal/business-agreement">Business Agreement</a>
      <a href="/api/legal/data-deletion">Data Deletion</a>
    </div>`;
}

// ─── Privacy Policy Page ────────────────────────────────────────────

function privacyPolicyPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Lime Of Time</title>
  <meta name="robots" content="index, follow">
  ${legalStyles()}
</head>
<body>
  <div class="container">
    <div class="logo-header">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/rvonQNLXSNYbyBpY.png" alt="Lime Of Time" style="width:64px;height:64px;border-radius:0;object-fit:contain;background:transparent;margin-bottom:12px;" /><br/>
      <h1>Lime Of Time</h1>
      <div class="subtitle">Scheduling Made Simple</div>
    </div>

    <h1>Privacy Policy</h1>
    <p class="effective-date">Effective Date: April 9, 2026 | Last Updated: April 9, 2026</p>

    <div class="card">
      <p>Lime Of Time ("we," "our," or "us") operates the Lime Of Time mobile application and website (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>
    </div>

    <h2>1. Information We Collect</h2>

    <h3>1.1 Information You Provide</h3>
    <ul>
      <li><strong>Account Information:</strong> When you create a business account, we collect your business name, phone number, email address, and business address.</li>
      <li><strong>Client Information:</strong> Business owners may add client names, phone numbers, email addresses, and appointment notes.</li>
      <li><strong>Booking Information:</strong> When clients book appointments through public booking links, we collect their name, phone number, selected service, and appointment preferences.</li>
      <li><strong>Communications:</strong> Any messages, feedback, or support requests you send to us.</li>
    </ul>

    <h3>1.2 Information Collected Automatically</h3>
    <ul>
      <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, and mobile network information.</li>
      <li><strong>Usage Data:</strong> App interaction data, features used, screens visited, and timestamps.</li>
      <li><strong>Log Data:</strong> IP address, browser type, pages visited, and access times when using our web services.</li>
      <li><strong>Cookies:</strong> We use essential cookies to maintain session state on our web pages. See our Cookie Policy section below.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To provide, maintain, and improve the Service</li>
      <li>To process and manage appointment bookings</li>
      <li>To send appointment confirmations, reminders, and notifications</li>
      <li>To enable business owners to manage their scheduling operations</li>
      <li>To communicate with you about the Service, including updates and support</li>
      <li>To detect, prevent, and address technical issues and security threats</li>
      <li>To comply with legal obligations</li>
    </ul>

    <h2>3. How We Share Your Information</h2>
    <p>We do not sell your personal information. We may share information in the following circumstances:</p>
    <ul>
      <li><strong>Between Business Owners and Clients:</strong> When a client books an appointment, their booking information is shared with the business owner. Business contact information is displayed on public booking pages.</li>
      <li><strong>Service Providers:</strong> We use third-party services for hosting, database management, and communication (e.g., SMS notifications). These providers only access data necessary to perform their functions.</li>
      <li><strong>Legal Requirements:</strong> We may disclose information if required by law, regulation, legal process, or governmental request.</li>
      <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred.</li>
    </ul>

    <h2>4. Data Storage and Security</h2>
    <p>Your data is stored on secure servers with encryption in transit (TLS/SSL) and at rest. We implement industry-standard security measures including:</p>
    <ul>
      <li>Encrypted database connections</li>
      <li>Secure session management</li>
      <li>Regular security updates and monitoring</li>
      <li>Access controls and authentication requirements</li>
    </ul>
    <p>While we strive to protect your information, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.</p>

    <h2>5. Data Retention</h2>
    <p>We retain your information for as long as your account is active or as needed to provide the Service. Business data (appointments, clients, services) is retained for the duration of the business account. You may request deletion of your data at any time (see Section 8).</p>

    <h2>6. Your Rights</h2>
    <p>Depending on your location, you may have the following rights:</p>
    <ul>
      <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
      <li><strong>Correction:</strong> Request correction of inaccurate personal data.</li>
      <li><strong>Deletion:</strong> Request deletion of your personal data (see Section 8).</li>
      <li><strong>Portability:</strong> Request a machine-readable copy of your data.</li>
      <li><strong>Objection:</strong> Object to processing of your personal data in certain circumstances.</li>
      <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances.</li>
    </ul>

    <h2>7. California Privacy Rights (CCPA)</h2>
    <p>If you are a California resident, you have the right to:</p>
    <ul>
      <li>Know what personal information we collect and how it is used</li>
      <li>Request deletion of your personal information</li>
      <li>Opt out of the sale of personal information (we do not sell personal information)</li>
      <li>Non-discrimination for exercising your privacy rights</li>
    </ul>

    <h2>8. Data Deletion</h2>
    <p>You may request deletion of your personal data by:</p>
    <ul>
      <li>Using the "Delete My Account" option in the app Settings</li>
      <li>Submitting a request through our <a href="/api/legal/data-deletion">Data Deletion Request</a> page</li>
      <li>Contacting us at the email address below</li>
    </ul>
    <p>We will process deletion requests within 30 days. Some data may be retained as required by law or for legitimate business purposes (e.g., fraud prevention, legal compliance).</p>

    <h2>9. Children's Privacy</h2>
    <p>Our Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.</p>

    <h2>10. International Data Transfers</h2>
    <p>Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.</p>

    <h2>11. Cookie Policy</h2>
    <p>Our web services use the following types of cookies:</p>
    <ul>
      <li><strong>Essential Cookies:</strong> Required for the booking system to function (session management, form submission).</li>
      <li><strong>Functional Cookies:</strong> Remember your preferences (e.g., dark mode setting).</li>
    </ul>
    <p>We do not use advertising or tracking cookies. You can control cookies through your browser settings.</p>

    <h2>12. Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy with a new effective date. Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>

    <h2>13. Contact Us</h2>
    <div class="card">
      <p>If you have questions about this Privacy Policy or wish to exercise your rights, contact us at:</p>
      <p><strong>Lime Of Time</strong><br>
      Email: privacy@lime-of-time.com<br>
      Website: <a href="https://lime-of-time.com">lime-of-time.com</a></p>
    </div>

    ${legalFooter()}
  </div>
</body>
</html>`;
}

// ─── Terms of Service Page ──────────────────────────────────────────

function termsOfServicePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service - Lime Of Time</title>
  <meta name="robots" content="index, follow">
  ${legalStyles()}
</head>
<body>
  <div class="container">
    <div class="logo-header">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/rvonQNLXSNYbyBpY.png" alt="Lime Of Time" style="width:64px;height:64px;border-radius:0;object-fit:contain;background:transparent;margin-bottom:12px;" /><br/>
      <h1>Lime Of Time</h1>
      <div class="subtitle">Scheduling Made Simple</div>
    </div>

    <h1>Terms of Service</h1>
    <p class="effective-date">Effective Date: April 9, 2026 | Last Updated: April 9, 2026</p>

    <div class="card">
      <p>These Terms of Service ("Terms") govern your use of the Lime Of Time mobile application and website (the "Service") operated by Lime Of Time ("we," "our," or "us"). By accessing or using the Service, you agree to be bound by these Terms.</p>
    </div>

    <h2>1. Acceptance of Terms</h2>
    <p>By creating an account, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must not use the Service.</p>

    <h2>2. Description of Service</h2>
    <p>Lime Of Time is a scheduling and appointment management platform that enables:</p>
    <ul>
      <li>Business owners to manage their services, clients, and appointments</li>
      <li>Business owners to create public booking pages for client self-scheduling</li>
      <li>Clients to book, reschedule, and cancel appointments</li>
      <li>Communication between business owners and clients regarding appointments</li>
    </ul>

    <h2>3. User Accounts</h2>
    <h3>3.1 Registration</h3>
    <p>To use certain features, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate.</p>
    <h3>3.2 Account Security</h3>
    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.</p>
    <h3>3.3 Account Termination</h3>
    <p>We reserve the right to suspend or terminate your account if you violate these Terms or engage in fraudulent, abusive, or illegal activity.</p>

    <h2>4. Acceptable Use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
      <li>Impersonate any person or entity or misrepresent your affiliation</li>
      <li>Interfere with or disrupt the Service or servers</li>
      <li>Attempt to gain unauthorized access to any part of the Service</li>
      <li>Use the Service to send spam, unsolicited messages, or harassing communications</li>
      <li>Upload malicious code, viruses, or harmful content</li>
      <li>Scrape, crawl, or use automated means to access the Service without permission</li>
      <li>Use the Service to collect personal information of others without consent</li>
    </ul>

    <h2>5. Business Owner Responsibilities</h2>
    <p>As a business owner using the Service, you agree to:</p>
    <ul>
      <li>Provide accurate business information, including name, address, and contact details</li>
      <li>Honor appointments booked through the Service</li>
      <li>Maintain appropriate licenses and permits for your business</li>
      <li>Comply with all applicable laws regarding your business operations</li>
      <li>Handle client data in accordance with applicable privacy laws</li>
      <li>Not use the Service to discriminate against any person or group</li>
    </ul>

    <h2>6. Client Responsibilities</h2>
    <p>As a client booking through the Service, you agree to:</p>
    <ul>
      <li>Provide accurate contact information when booking</li>
      <li>Arrive on time for scheduled appointments</li>
      <li>Cancel or reschedule appointments in a timely manner</li>
      <li>Comply with the business owner's cancellation policy</li>
    </ul>

    <h2>7. Intellectual Property</h2>
    <p>The Service, including its design, features, content, and code, is owned by Lime Of Time and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.</p>

    <h2>8. Disclaimer of Warranties</h2>
    <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>

    <h2>9. Limitation of Liability</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, LIME OF TIME SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.</p>
    <p>OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</p>

    <h2>10. Indemnification</h2>
    <p>You agree to indemnify, defend, and hold harmless Lime Of Time, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from your use of the Service or violation of these Terms.</p>

    <h2>11. Modifications to Terms</h2>
    <p>We reserve the right to modify these Terms at any time. We will provide notice of material changes by posting the updated Terms with a new effective date. Your continued use of the Service after changes constitutes acceptance.</p>

    <h2>12. Governing Law</h2>
    <p>These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Pennsylvania, United States, without regard to its conflict of law provisions.</p>

    <h2>13. Dispute Resolution</h2>
    <p>Any disputes arising from these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration in Pittsburgh, Pennsylvania, in accordance with the rules of the American Arbitration Association.</p>

    <h2>14. Severability</h2>
    <p>If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.</p>

    <h2>15. Contact Us</h2>
    <div class="card">
      <p>For questions about these Terms, contact us at:</p>
      <p><strong>Lime Of Time</strong><br>
      Email: legal@lime-of-time.com<br>
      Website: <a href="https://lime-of-time.com">lime-of-time.com</a></p>
    </div>

    ${legalFooter()}
  </div>
</body>
</html>`;
}

// ─── EULA Page ──────────────────────────────────────────────────────

function eulaPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>End User License Agreement - Lime Of Time</title>
  <meta name="robots" content="index, follow">
  ${legalStyles()}
</head>
<body>
  <div class="container">
    <div class="logo-header">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/rvonQNLXSNYbyBpY.png" alt="Lime Of Time" style="width:64px;height:64px;border-radius:0;object-fit:contain;background:transparent;margin-bottom:12px;" /><br/>
      <h1>Lime Of Time</h1>
      <div class="subtitle">Scheduling Made Simple</div>
    </div>

    <h1>End User License Agreement</h1>
    <p class="effective-date">Effective Date: April 9, 2026 | Last Updated: April 9, 2026</p>

    <div class="card">
      <p>This End User License Agreement ("EULA") is a legal agreement between you ("User") and Lime Of Time ("Licensor") for the use of the Lime Of Time mobile application ("Application"). By installing or using the Application, you agree to be bound by this EULA.</p>
    </div>

    <h2>1. License Grant</h2>
    <p>Subject to the terms of this EULA, we grant you a limited, non-exclusive, non-transferable, revocable license to download, install, and use the Application on mobile devices that you own or control, solely for your personal or business use.</p>

    <h2>2. License Restrictions</h2>
    <p>You shall not:</p>
    <ul>
      <li>Copy, modify, or distribute the Application</li>
      <li>Reverse engineer, decompile, or disassemble the Application</li>
      <li>Rent, lease, lend, sell, or sublicense the Application</li>
      <li>Remove or alter any proprietary notices or labels</li>
      <li>Use the Application for any purpose that violates applicable laws</li>
      <li>Use the Application to develop a competing product or service</li>
    </ul>

    <h2>3. Ownership</h2>
    <p>The Application is licensed, not sold. Lime Of Time retains all right, title, and interest in and to the Application, including all intellectual property rights. This EULA does not grant you any ownership rights.</p>

    <h2>4. User Content</h2>
    <p>You retain ownership of any data or content you create through the Application (business information, client records, appointment data). You grant us a limited license to store, process, and display this content solely to provide the Service.</p>

    <h2>5. Third-Party Services</h2>
    <p>The Application may integrate with third-party services (e.g., payment processors, SMS providers). Your use of these services is subject to their respective terms and privacy policies. We are not responsible for third-party services.</p>

    <h2>6. Updates</h2>
    <p>We may release updates to the Application from time to time. Updates may be required for continued use. By using the Application, you consent to automatic updates.</p>

    <h2>7. Termination</h2>
    <p>This EULA is effective until terminated. It will terminate automatically if you fail to comply with any term. Upon termination, you must cease all use of the Application and delete all copies.</p>

    <h2>8. Disclaimer of Warranties</h2>
    <p>THE APPLICATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>

    <h2>9. Limitation of Liability</h2>
    <p>IN NO EVENT SHALL LIME OF TIME BE LIABLE FOR ANY SPECIAL, INCIDENTAL, INDIRECT, OR CONSEQUENTIAL DAMAGES WHATSOEVER ARISING OUT OF OR RELATED TO YOUR USE OF THE APPLICATION.</p>

    <h2>10. Apple App Store Additional Terms</h2>
    <p>If you downloaded the Application from the Apple App Store:</p>
    <ul>
      <li>This EULA is between you and Lime Of Time, not Apple Inc.</li>
      <li>Apple has no obligation to provide maintenance or support for the Application</li>
      <li>Apple is not responsible for any claims relating to the Application</li>
      <li>Apple is a third-party beneficiary of this EULA</li>
    </ul>

    <h2>11. Google Play Additional Terms</h2>
    <p>If you downloaded the Application from Google Play:</p>
    <ul>
      <li>This EULA is between you and Lime Of Time, not Google LLC</li>
      <li>Google has no obligation to provide maintenance or support for the Application</li>
      <li>Google is not responsible for any claims relating to the Application</li>
    </ul>

    <h2>12. Governing Law</h2>
    <p>This EULA shall be governed by the laws of the Commonwealth of Pennsylvania, United States.</p>

    <h2>13. Contact</h2>
    <div class="card">
      <p>For questions about this EULA, contact us at:</p>
      <p><strong>Lime Of Time</strong><br>
      Email: legal@lime-of-time.com<br>
      Website: <a href="https://lime-of-time.com">lime-of-time.com</a></p>
    </div>

    ${legalFooter()}
  </div>
</body>
</html>`;
}

// ─── Business Owner Agreement Page ──────────────────────────────────

function businessAgreementPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Business Owner Agreement - Lime Of Time</title>
  <meta name="robots" content="index, follow">
  ${legalStyles()}
</head>
<body>
  <div class="container">
    <div class="logo-header">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/rvonQNLXSNYbyBpY.png" alt="Lime Of Time" style="width:64px;height:64px;border-radius:0;object-fit:contain;background:transparent;margin-bottom:12px;" /><br/>
      <h1>Lime Of Time</h1>
      <div class="subtitle">Scheduling Made Simple</div>
    </div>

    <h1>Business Owner Agreement</h1>
    <p class="effective-date">Effective Date: April 9, 2026 | Last Updated: April 9, 2026</p>

    <div class="card">
      <p>This Business Owner Agreement ("Agreement") governs the relationship between you ("Business Owner") and Lime Of Time ("Platform") when you use the Lime Of Time platform to manage your business scheduling and client interactions.</p>
    </div>

    <h2>1. Platform Services</h2>
    <p>Lime Of Time provides the following services to Business Owners:</p>
    <ul>
      <li>Appointment scheduling and calendar management</li>
      <li>Public booking page generation and hosting</li>
      <li>Client management and communication tools</li>
      <li>Service and pricing management</li>
      <li>Business analytics and reporting</li>
      <li>Gift card and discount management</li>
    </ul>

    <h2>2. Business Owner Obligations</h2>
    <p>As a Business Owner on the Platform, you agree to:</p>
    <ul>
      <li>Provide accurate and up-to-date business information</li>
      <li>Maintain valid business licenses and permits as required by your jurisdiction</li>
      <li>Deliver services as described in your service listings</li>
      <li>Respond to booking requests in a timely manner</li>
      <li>Handle client data in compliance with applicable privacy laws</li>
      <li>Not engage in discriminatory practices</li>
      <li>Maintain professional conduct in all client interactions</li>
    </ul>

    <h2>3. Client Data Responsibilities</h2>
    <p>You acknowledge that you are a data controller for client information you collect through the Platform. You agree to:</p>
    <ul>
      <li>Only collect client data necessary for providing your services</li>
      <li>Not share client data with third parties without consent</li>
      <li>Respond to client data deletion requests promptly</li>
      <li>Implement reasonable security measures for client data</li>
    </ul>

    <h2>4. Booking and Cancellation Policies</h2>
    <p>You may set your own cancellation policies through the Platform. You agree that:</p>
    <ul>
      <li>Cancellation policies must be clearly communicated to clients before booking</li>
      <li>Cancellation fees must be reasonable and proportionate</li>
      <li>You will honor confirmed bookings unless exceptional circumstances arise</li>
    </ul>

    <h2>5. Platform Fees</h2>
    <p>The current fee structure is as follows:</p>
    <ul>
      <li><strong>Free Tier:</strong> Basic scheduling features at no cost</li>
      <li><strong>Paid Tiers:</strong> Additional features available through subscription plans</li>
      <li><strong>Transaction Fees:</strong> If payment processing is enabled, standard payment processor fees apply</li>
    </ul>
    <p>We reserve the right to modify the fee structure with 30 days' notice.</p>

    <h2>6. Intellectual Property</h2>
    <p>You retain ownership of your business content (logos, descriptions, service information). You grant the Platform a license to display this content on booking pages and within the Service.</p>

    <h2>7. Termination</h2>
    <p>Either party may terminate this Agreement at any time. Upon termination:</p>
    <ul>
      <li>Your public booking pages will be deactivated</li>
      <li>You may export your data before account closure</li>
      <li>We will retain data as required by law or as specified in our Privacy Policy</li>
    </ul>

    <h2>8. Limitation of Liability</h2>
    <p>THE PLATFORM IS NOT LIABLE FOR ANY DISPUTES BETWEEN BUSINESS OWNERS AND CLIENTS, INCLUDING DISPUTES OVER SERVICE QUALITY, PRICING, OR CANCELLATIONS. THE PLATFORM SERVES AS A SCHEDULING TOOL AND IS NOT A PARTY TO THE SERVICE AGREEMENT BETWEEN YOU AND YOUR CLIENTS.</p>

    <h2>9. Indemnification</h2>
    <p>You agree to indemnify and hold harmless Lime Of Time from any claims arising from your business operations, your use of the Platform, or your violation of this Agreement.</p>

    <h2>10. Contact</h2>
    <div class="card">
      <p>For questions about this Agreement, contact us at:</p>
      <p><strong>Lime Of Time</strong><br>
      Email: business@lime-of-time.com<br>
      Website: <a href="https://lime-of-time.com">lime-of-time.com</a></p>
    </div>

    ${legalFooter()}
  </div>
</body>
</html>`;
}

// ─── Data Deletion Request Page ─────────────────────────────────────

function dataDeletionPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Deletion Request - Lime Of Time</title>
  <meta name="robots" content="noindex, nofollow">
  ${legalStyles()}
</head>
<body>
  <div class="container">
    <div class="logo-header">
      <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663347678319/rvonQNLXSNYbyBpY.png" alt="Lime Of Time" style="width:64px;height:64px;border-radius:0;object-fit:contain;background:transparent;margin-bottom:12px;" /><br/>
      <h1>Lime Of Time</h1>
      <div class="subtitle">Scheduling Made Simple</div>
    </div>

    <h1>Data Deletion Request</h1>
    <p>Submit a request to delete your personal data from Lime Of Time. We will process your request within 30 days in accordance with applicable privacy laws.</p>

    <div class="card">
      <form id="deletionForm" onsubmit="submitRequest(event)">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" name="email" placeholder="your@email.com">
        </div>

        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input type="tel" id="phone" name="phone" placeholder="(555) 000-0000">
        </div>

        <div class="form-group">
          <label for="type">Deletion Type</label>
          <select id="type" name="type">
            <option value="full">Full Account & Data Deletion</option>
            <option value="client_data">Client Booking Data Only</option>
            <option value="business_data">Business Account Data Only</option>
          </select>
        </div>

        <div class="form-group">
          <label for="reason">Reason (Optional)</label>
          <textarea id="reason" name="reason" placeholder="Please tell us why you'd like your data deleted..."></textarea>
        </div>

        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
          By submitting this request, you understand that data deletion is permanent and cannot be undone. 
          You must provide either an email address or phone number so we can verify your identity.
        </p>

        <button type="submit" class="btn-submit" id="submitBtn">Submit Deletion Request</button>

        <div class="success-msg" id="successMsg">
          Your data deletion request has been submitted successfully. We will process it within 30 days. You will receive a confirmation when the deletion is complete.
        </div>
      </form>
    </div>

    <h2>What Gets Deleted</h2>
    <div class="card">
      <h3>Full Account Deletion</h3>
      <ul>
        <li>Your business profile and all associated data</li>
        <li>All client records you've created</li>
        <li>All appointment history</li>
        <li>All services, products, and pricing</li>
        <li>All reviews, gift cards, and discounts</li>
        <li>Your public booking page</li>
        <li>Your account credentials</li>
      </ul>

      <h3 style="margin-top: 20px;">Client Data Deletion</h3>
      <ul>
        <li>Your booking records across all businesses</li>
        <li>Your contact information stored by businesses</li>
        <li>Your review history</li>
      </ul>
    </div>

    <h2>What We May Retain</h2>
    <div class="card">
      <p>In accordance with legal requirements, we may retain certain data even after a deletion request:</p>
      <ul>
        <li>Transaction records required for tax or accounting purposes</li>
        <li>Data necessary to resolve ongoing disputes</li>
        <li>Information required by law enforcement or legal proceedings</li>
        <li>Anonymized and aggregated data that cannot identify you</li>
      </ul>
    </div>

    ${legalFooter()}
  </div>

  <script>
    async function submitRequest(e) {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      if (!email && !phone) {
        alert('Please provide either an email address or phone number.');
        return;
      }
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.textContent = 'Submitting...';
      try {
        const resp = await fetch('/api/legal/data-deletion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone,
            type: document.getElementById('type').value,
            reason: document.getElementById('reason').value
          })
        });
        if (resp.ok) {
          document.getElementById('deletionForm').style.display = 'none';
          document.getElementById('successMsg').style.display = 'block';
        } else {
          const data = await resp.json();
          alert(data.error || 'Failed to submit request. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Submit Deletion Request';
        }
      } catch (err) {
        alert('Network error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Submit Deletion Request';
      }
    }
  </script>
</body>
</html>`;
}
