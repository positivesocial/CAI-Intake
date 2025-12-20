import Link from "next/link";

export const metadata = {
  title: "Terms of Service - CAI Intake",
  description: "Terms of Service for CAI Intake cutlist management platform",
};

export default function TermsOfServicePage() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-[var(--muted-foreground)] mb-8">
          Last updated: {lastUpdated}
        </p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              By accessing or using CAI Intake (&quot;Service&quot;), you agree to be bound by these Terms of 
              Service (&quot;Terms&quot;). If you disagree with any part of these terms, you may not access 
              the Service. These Terms apply to all visitors, users, and others who access or use 
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              CAI Intake is a cutlist management platform designed for cabinet and woodworking 
              professionals. The Service provides tools for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)] mt-4">
              <li>Creating and managing cutlists</li>
              <li>Importing data from various sources (text, Excel, voice, images)</li>
              <li>Optimizing material usage</li>
              <li>Exporting cutlists to various formats</li>
              <li>Team collaboration and organization management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Account Registration</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed mb-4">
              To use certain features of the Service, you must register for an account. When 
              registering, you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and update your information to keep it accurate</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Subscription and Payment</h2>
            
            <h3 className="text-lg font-medium mt-4 mb-2">4.1 Subscription Plans</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              The Service offers various subscription plans with different features and limits. 
              Plan details are available on our pricing page.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">4.2 Billing</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Subscriptions are billed in advance on a monthly or annual basis. You authorize 
              us to charge your payment method for all fees incurred.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">4.3 Refunds</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Refunds are provided in accordance with our refund policy. Annual subscriptions 
              may be eligible for prorated refunds within 30 days of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Acceptable Use</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed mb-4">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[var(--muted-foreground)]">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Transmit malware, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to systems</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Engage in data mining, scraping, or automated access</li>
              <li>Impersonate others or provide false information</li>
              <li>Use the Service for illegal or unauthorized purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Your Content</h2>
            
            <h3 className="text-lg font-medium mt-4 mb-2">6.1 Ownership</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              You retain ownership of all content you submit to the Service, including cutlists, 
              materials, and project data (&quot;Your Content&quot;).
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">6.2 License to Us</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              By submitting Your Content, you grant us a non-exclusive, worldwide, royalty-free 
              license to use, store, and process Your Content solely for providing the Service.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">6.3 Responsibility</h3>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              You are responsible for Your Content and ensuring you have the right to submit it. 
              We do not endorse or guarantee the accuracy of any content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              The Service, including its original content, features, and functionality, is owned 
              by CAI Intake and protected by international copyright, trademark, and other 
              intellectual property laws. Our trademarks may not be used without prior written 
              consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Third-Party Services</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              The Service may integrate with third-party services. We are not responsible for 
              the content, privacy policies, or practices of third-party services. You 
              acknowledge and agree that we shall not be liable for any damage or loss caused 
              by your use of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAI INTAKE SHALL NOT BE LIABLE FOR ANY 
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT 
              NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM 
              YOUR USE OF THE SERVICE.
            </p>
            <p className="text-[var(--muted-foreground)] leading-relaxed mt-4">
              OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL 
              NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY 
              KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF 
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-[var(--muted-foreground)] leading-relaxed mt-4">
              We do not warrant that the Service will be uninterrupted, error-free, or secure. 
              Optimization results and material calculations are estimates and should be 
              verified before production.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Indemnification</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              You agree to indemnify, defend, and hold harmless CAI Intake and its officers, 
              directors, employees, and agents from any claims, damages, losses, or expenses 
              arising from your use of the Service, violation of these Terms, or infringement 
              of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Termination</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, 
              without prior notice, for conduct that we believe violates these Terms or is 
              harmful to other users, us, or third parties, or for any other reason.
            </p>
            <p className="text-[var(--muted-foreground)] leading-relaxed mt-4">
              Upon termination, your right to use the Service will cease immediately. You may 
              export your data before termination. Data retention after termination is subject 
              to our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Changes to Terms</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of 
              material changes by posting the new Terms on this page and updating the 
              &quot;Last updated&quot; date. Your continued use of the Service after changes 
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">14. Governing Law</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of 
              the jurisdiction in which CAI Intake is incorporated, without regard to its 
              conflict of law provisions. Any disputes shall be resolved in the courts of 
              that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">15. Severability</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that 
              provision shall be limited or eliminated to the minimum extent necessary, and 
              the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">16. Contact Information</h2>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              If you have questions about these Terms, please contact us:
            </p>
            <div className="mt-4 p-4 bg-[var(--muted)] rounded-lg">
              <p className="font-medium">CAI Intake</p>
              <p className="text-[var(--muted-foreground)]">Email: legal@caiintake.com</p>
              <p className="text-[var(--muted-foreground)]">Support: support@caiintake.com</p>
            </div>
          </section>
        </div>

        {/* Navigation */}
        <div className="mt-12 pt-8 border-t border-[var(--border)] flex items-center justify-between">
          <Link href="/privacy" className="text-[var(--cai-teal)] hover:underline">
            ← Privacy Policy
          </Link>
          <Link href="/" className="text-[var(--cai-teal)] hover:underline">
            Back to Home →
          </Link>
        </div>
      </main>
    </div>
  );
}

