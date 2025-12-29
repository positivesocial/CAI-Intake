/**
 * CAI Intake - Contact Form API
 * 
 * POST /api/v1/contact
 * Handles contact form submissions and sends emails
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

// Schema for contact form
const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  company: z.string().max(100).optional(),
  subject: z.enum(["general", "sales", "support", "partnership"]),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
});

// Subject labels for email
const SUBJECT_LABELS: Record<string, string> = {
  general: "General Inquiry",
  sales: "Sales Inquiry",
  support: "Technical Support",
  partnership: "Partnership Inquiry",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = contactSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, company, subject, message } = result.data;

    // Log the contact submission
    logger.info("Contact form submission", {
      name,
      email,
      company,
      subject,
    });

    // Build email content
    const subjectLabel = SUBJECT_LABELS[subject] || subject;
    const emailSubject = `[CAI Intake] ${subjectLabel} from ${name}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0a1628;">New Contact Form Submission</h2>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px;"><strong>Subject:</strong> ${subjectLabel}</p>
          <p style="margin: 0 0 10px;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 0 0 10px;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${company ? `<p style="margin: 0 0 10px;"><strong>Company:</strong> ${company}</p>` : ""}
        </div>
        
        <h3 style="color: #0a1628;">Message:</h3>
        <div style="background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; white-space: pre-wrap;">
${message}
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        
        <p style="color: #666; font-size: 12px;">
          This email was sent from the CAI Intake contact form.<br>
          Submitted at: ${new Date().toISOString()}<br>
          Reply directly to this email to respond to the sender.
        </p>
      </div>
    `;

    const emailText = `
New Contact Form Submission

Subject: ${subjectLabel}
Name: ${name}
Email: ${email}
${company ? `Company: ${company}` : ""}

Message:
${message}

---
Submitted at: ${new Date().toISOString()}
    `.trim();

    // Send email to support team
    const supportEmail = process.env.SUPPORT_EMAIL || "support@cai-intake.io";
    const emailResult = await sendEmail({
      to: supportEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailText,
      replyTo: email,
    });

    if (!emailResult.success) {
      logger.error("Failed to send contact form email", { error: emailResult.error });
      return NextResponse.json(
        { error: "Failed to send message. Please try again or email us directly." },
        { status: 500 }
      );
    }

    // Send confirmation email to user
    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; padding: 20px;">
          <h1 style="color: #00d4aa; margin: 0;">CAI Intake</h1>
        </div>
        
        <h2 style="color: #0a1628;">Thank you for contacting us!</h2>
        
        <p>Hi ${name},</p>
        
        <p>We've received your message and will get back to you within 24 hours.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px;"><strong>Your message:</strong></p>
          <p style="margin: 0; white-space: pre-wrap; color: #666;">${message.slice(0, 200)}${message.length > 200 ? "..." : ""}</p>
        </div>
        
        <p>In the meantime, you might find these resources helpful:</p>
        <ul>
          <li><a href="https://app.cai-intake.io/help" style="color: #00d4aa;">Help & Support Center</a></li>
          <li><a href="https://app.cai-intake.io/docs" style="color: #00d4aa;">Documentation</a></li>
        </ul>
        
        <p>Best regards,<br>The CAI Intake Team</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        
        <p style="color: #666; font-size: 12px; text-align: center;">
          CAI Intake - The definitive cutlist data ingestion engine<br>
          <a href="https://cai-intake.io" style="color: #00d4aa;">cai-intake.io</a>
        </p>
      </div>
    `;

    // Send confirmation (don't fail if this fails)
    await sendEmail({
      to: email,
      subject: "We received your message - CAI Intake",
      html: confirmationHtml,
      text: `Hi ${name},\n\nThank you for contacting us! We've received your message and will get back to you within 24 hours.\n\nBest regards,\nThe CAI Intake Team`,
    }).catch((err) => {
      logger.warn("Failed to send confirmation email", { error: err });
    });

    return NextResponse.json({
      success: true,
      message: "Your message has been sent successfully. We'll get back to you within 24 hours.",
    });

  } catch (error) {
    logger.error("Contact form error", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

