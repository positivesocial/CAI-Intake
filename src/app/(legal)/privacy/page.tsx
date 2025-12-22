import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - CAI Intake",
  description: "Privacy Policy for CAI Intake cutlist management platform",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "December 20, 2024";
  
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="text-xl font-bold text-[var(--cai-teal)]">
            CAI Intake
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[var(--muted-foreground)] mb-8">
          Last updated: {lastUpdated}
        </p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Welcome to CAI Intake (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your 
              privacy and ensuring the security of your personal information. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use 
              our cutlist management platform and related services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li><strong>Account Information:</strong> Name, email address, password, organization name</li>
              <li><strong>Profile Information:</strong> Job title, phone number, profile picture</li>
              <li><strong>Cutlist Data:</strong> Part dimensions, materials, quantities, and project specifications</li>
              <li><strong>Payment Information:</strong> Billing address, payment method details (processed by our payment provider)</li>
              <li><strong>Communications:</strong> Messages you send to our support team</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li><strong>Usage Data:</strong> Features used, time spent, actions performed</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
              <li><strong>Log Data:</strong> IP address, access times, pages viewed, error logs</li>
              <li><strong>Cookies:</strong> Session cookies, preference cookies, analytics cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li>Provide, maintain, and improve our services</li>
              <li>Process your cutlists and optimization requests</li>
              <li>Send transactional emails (confirmations, notifications)</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Detect and prevent fraud, abuse, and security issues</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li><strong>Service Providers:</strong> With vendors who assist in operating our platform (hosting, analytics, payment processing)</li>
              <li><strong>Organization Members:</strong> With other members of your organization as permitted by your admin settings</li>
              <li><strong>Legal Requirements:</strong> When required by law, subpoena, or legal process</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)] mt-4">
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and authentication requirements</li>
              <li>Employee training on data protection</li>
              <li>Incident response procedures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services. 
              After account deletion, we may retain certain data for legal compliance, dispute resolution, 
              and fraud prevention for up to 7 years. Cutlist data may be anonymized and retained for 
              analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Your Rights and Choices</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Objection:</strong> Object to certain processing activities</li>
              <li><strong>Withdraw Consent:</strong> Withdraw previously given consent</li>
            </ul>
            <p className="text-[var(--muted-foreground)] leading-relaxed mt-4">
              To exercise these rights, contact us at privacy@cai-intake.io.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Cookies and Tracking</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              We use cookies and similar technologies to enhance your experience. You can manage 
              cookie preferences through your browser settings. Note that disabling certain cookies 
              may affect platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. International Data Transfers</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Your data may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place, such as Standard Contractual Clauses, 
              when transferring data internationally.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Children&apos;s Privacy</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Our services are not intended for users under 16 years of age. We do not knowingly 
              collect personal information from children. If we learn that we have collected data 
              from a child, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Changes to This Policy</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes 
              by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your 
              continued use of the platform after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Contact Us</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-4 p-4 bg-[var(--muted)] rounded-lg">
              <p className="font-medium">CAI Intake</p>
              <p className="text-[var(--muted-foreground)]">Email: privacy@cai-intake.io</p>
              <p className="text-[var(--muted-foreground)]">Support: support@cai-intake.io</p>
            </div>
          </section>
        </div>

        {/* Navigation */}
        <div className="mt-12 pt-8 border-t border-[var(--border)] flex items-center justify-between">
          <Link href="/" className="text-[var(--cai-teal)] hover:underline">
            ← Back to Home
          </Link>
          <Link href="/terms" className="text-[var(--cai-teal)] hover:underline">
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  );
}




