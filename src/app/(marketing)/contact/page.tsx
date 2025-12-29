"use client";

import * as React from "react";
import { useState } from "react";
import { Metadata } from "next";

const metadata: Metadata = {
  title: "Contact - CAI Intake",
  description: "Get in touch with the CAI Intake team for support, sales, or partnership inquiries.",
};

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    subject: "general",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setIsSubmitting(false);
      setSubmitted(true);
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    }
  };

  if (submitted) {
    return (
      <div className="py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-20 h-20 bg-[#00d4aa]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Message Sent!</h1>
            <p className="text-white/70 mb-8">
              Thank you for reaching out. We&apos;ll get back to you within 24 hours.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({ name: "", email: "", company: "", subject: "general", message: "" });
              }}
              className="px-6 py-3 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all"
            >
              Send Another Message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16">
      {/* Hero */}
      <section className="container mx-auto px-6 text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Get in <span className="text-[#00d4aa]">Touch</span>
        </h1>
        <p className="text-xl text-white/70 max-w-3xl mx-auto">
          Have questions about CAI Intake? We&apos;re here to help.
        </p>
      </section>

      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Contact Form */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-8">
            <h2 className="text-2xl font-semibold mb-6">Send us a message</h2>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#00d4aa]/50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#00d4aa]/50"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Company (optional)</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#00d4aa]/50"
                  placeholder="Your company"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#00d4aa]/50"
                >
                  <option value="general">General Inquiry</option>
                  <option value="sales">Sales</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  rows={5}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#00d4aa]/50 resize-none"
                  placeholder="How can we help?"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 rounded-lg bg-[#00d4aa] text-[#0a1628] font-semibold hover:bg-[#00e6b8] transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-6">Contact Information</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#00d4aa]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium">Email</h3>
                    <p className="text-white/60">support@cai-intake.io</p>
                    <p className="text-white/60">sales@cai-intake.io</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#00d4aa]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium">Response Time</h3>
                    <p className="text-white/60">We typically respond within 24 hours</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Need Immediate Help?</h3>
              <p className="text-white/60 text-sm mb-4">
                Check our documentation for quick answers to common questions.
              </p>
              <a
                href="/docs"
                className="text-[#00d4aa] hover:text-[#00e6b8] text-sm font-medium flex items-center gap-2"
              >
                View Documentation
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

