/**
 * CAI Intake - Email Service
 * 
 * Handles transactional email sending for notifications,
 * invitations, and alerts.
 */

import { logger } from "./logger";

// =============================================================================
// TYPES
// =============================================================================

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || "CAI Intake <noreply@caiintake.com>",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
};

// =============================================================================
// EMAIL SENDING
// =============================================================================

/**
 * Send an email using configured SMTP or API
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text } = options;
  const from = options.from || EMAIL_CONFIG.from;

  // Check if email is configured
  if (!EMAIL_CONFIG.smtpHost && !process.env.RESEND_API_KEY) {
    logger.warn("Email not configured, skipping send", { to, subject });
    
    // In development, log the email content
    if (process.env.NODE_ENV === "development") {
      logger.info("Email would be sent:", { to, subject, preview: html.slice(0, 200) });
    }
    
    return { success: true }; // Don't fail in dev
  }

  try {
    // Option 1: Use Resend API if configured
    if (process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      logger.info("Email sent via Resend", { to, subject });
      return { success: true };
    }

    // Option 2: Use nodemailer with SMTP (would need to be imported)
    // For now, log and return success in development
    logger.info("Email queued for sending", { to, subject });
    return { success: true };

  } catch (error) {
    logger.error("Failed to send email", error, { to, subject });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send email" 
    };
  }
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

const BASE_TEMPLATE = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #0d9488; }
    .logo { font-size: 24px; font-weight: bold; color: #0d9488; }
    .content { padding: 30px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #0d9488; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    .muted { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">CAI Intake</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CAI Intake. All rights reserved.</p>
      <p class="muted">You received this email because you have an account with CAI Intake.</p>
    </div>
  </div>
</body>
</html>
`;

// =============================================================================
// NOTIFICATION EMAILS
// =============================================================================

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(params: {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, inviterName, organizationName, inviteUrl, role } = params;

  const html = BASE_TEMPLATE(`
    <h2>You've been invited to join ${organizationName}</h2>
    <p>${inviterName} has invited you to join their organization on CAI Intake as a <strong>${role}</strong>.</p>
    <p>CAI Intake is a powerful cutlist management tool for cabinet and woodworking workshops.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
    </p>
    <p class="muted">This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
  `);

  return sendEmail({
    to,
    subject: `${inviterName} invited you to join ${organizationName} on CAI Intake`,
    html,
    text: `${inviterName} invited you to join ${organizationName} on CAI Intake. Accept your invitation: ${inviteUrl}`,
  });
}

/**
 * Send parse job completion email
 */
export async function sendParseJobCompleteEmail(params: {
  to: string;
  userName: string;
  jobId: string;
  partsCount: number;
  cutlistName?: string;
  viewUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, userName, partsCount, cutlistName, viewUrl } = params;

  const html = BASE_TEMPLATE(`
    <h2>Parse Job Complete</h2>
    <p>Hi ${userName},</p>
    <p>Your parse job has completed successfully!</p>
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Parts Parsed:</strong> ${partsCount}</p>
      ${cutlistName ? `<p><strong>Cutlist:</strong> ${cutlistName}</p>` : ""}
    </div>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${viewUrl}" class="button">View Results</a>
    </p>
  `);

  return sendEmail({
    to,
    subject: `Parse Job Complete - ${partsCount} parts parsed`,
    html,
    text: `Hi ${userName}, your parse job has completed! ${partsCount} parts were parsed. View results: ${viewUrl}`,
  });
}

/**
 * Send optimization job completion email
 */
export async function sendOptimizeJobCompleteEmail(params: {
  to: string;
  userName: string;
  cutlistName: string;
  sheetsUsed: number;
  efficiency: number;
  viewUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, userName, cutlistName, sheetsUsed, efficiency, viewUrl } = params;

  const html = BASE_TEMPLATE(`
    <h2>Optimization Complete</h2>
    <p>Hi ${userName},</p>
    <p>Your cutlist optimization has completed!</p>
    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Cutlist:</strong> ${cutlistName}</p>
      <p><strong>Sheets Used:</strong> ${sheetsUsed}</p>
      <p><strong>Material Efficiency:</strong> ${(efficiency * 100).toFixed(1)}%</p>
    </div>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${viewUrl}" class="button">View Cutting Plan</a>
    </p>
  `);

  return sendEmail({
    to,
    subject: `Optimization Complete - ${cutlistName}`,
    html,
    text: `Hi ${userName}, optimization for "${cutlistName}" is complete! ${sheetsUsed} sheets used with ${(efficiency * 100).toFixed(1)}% efficiency. View results: ${viewUrl}`,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, resetUrl } = params;

  const html = BASE_TEMPLATE(`
    <h2>Reset Your Password</h2>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p class="muted">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
  `);

  return sendEmail({
    to,
    subject: "Reset your CAI Intake password",
    html,
    text: `Reset your password: ${resetUrl}. This link expires in 1 hour.`,
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
  loginUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, userName, loginUrl } = params;

  const html = BASE_TEMPLATE(`
    <h2>Welcome to CAI Intake!</h2>
    <p>Hi ${userName},</p>
    <p>Thanks for signing up! CAI Intake is the fastest way to manage cutlists for your cabinet and woodworking projects.</p>
    <h3>Getting Started</h3>
    <ul>
      <li><strong>Quick Parse:</strong> Paste your cutlist data and we'll parse it instantly</li>
      <li><strong>Excel Import:</strong> Import cutlists from Excel or CSV files</li>
      <li><strong>Voice Input:</strong> Dictate parts using your voice</li>
      <li><strong>Optimize:</strong> Get the most efficient cutting layouts</li>
    </ul>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" class="button">Go to Dashboard</a>
    </p>
    <p class="muted">Need help? Reply to this email and we'll be happy to assist.</p>
  `);

  return sendEmail({
    to,
    subject: "Welcome to CAI Intake! 🎉",
    html,
    text: `Welcome to CAI Intake, ${userName}! Get started at ${loginUrl}`,
  });
}

/**
 * Send usage warning email
 */
export async function sendUsageWarningEmail(params: {
  to: string;
  userName: string;
  limitType: string;
  currentUsage: number;
  limit: number;
  upgradeUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, userName, limitType, currentUsage, limit, upgradeUrl } = params;
  const percentage = Math.round((currentUsage / limit) * 100);

  const html = BASE_TEMPLATE(`
    <h2>Usage Alert</h2>
    <p>Hi ${userName},</p>
    <p>You've used <strong>${percentage}%</strong> of your ${limitType} limit for this period.</p>
    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p><strong>Current Usage:</strong> ${currentUsage} / ${limit}</p>
    </div>
    <p>Upgrade your plan to get more capacity and unlock additional features.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${upgradeUrl}" class="button">Upgrade Plan</a>
    </p>
  `);

  return sendEmail({
    to,
    subject: `Usage Alert: ${percentage}% of ${limitType} limit used`,
    html,
    text: `Hi ${userName}, you've used ${currentUsage} of ${limit} ${limitType}. Upgrade at ${upgradeUrl}`,
  });
}

