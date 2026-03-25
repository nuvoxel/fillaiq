import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | FillaIQ",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-16 px-6">
      <div className="mx-auto max-w-2xl prose prose-neutral dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: March 25, 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using FillaIQ (&quot;the Service&quot;), operated by
          NuVoxel LLC (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you
          agree to be bound by these Terms of Service. If you do not agree, do
          not use the Service.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          FillaIQ is an open-source workshop inventory system that helps users
          identify, weigh, and track filament spools, hardware, and workshop
          supplies. The Service includes a web dashboard, firmware for hardware
          devices, and related APIs.
        </p>

        <h2>3. Accounts</h2>
        <p>
          You may need to create an account to use certain features. You are
          responsible for maintaining the security of your account credentials
          and for all activity under your account.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful purpose</li>
          <li>
            Attempt to gain unauthorized access to the Service or its related
            systems
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the
            Service
          </li>
          <li>Upload malicious code or content</li>
        </ul>

        <h2>5. Open Source</h2>
        <p>
          FillaIQ is released under the MIT License. The source code is
          available on GitHub. These Terms govern your use of the hosted Service
          at fillaiq.com, not self-hosted instances.
        </p>

        <h2>6. Data and Privacy</h2>
        <p>
          Your use of the Service is also governed by our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>

        <h2>7. Disclaimer of Warranties</h2>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind, whether express or implied. We do not
          guarantee that the Service will be uninterrupted, error-free, or
          secure.
        </p>

        <h2>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, NuVoxel LLC shall not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages arising from your use of the Service.
        </p>

        <h2>9. Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of the
          Service after changes constitutes acceptance of the updated Terms.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:mike@nuvoxel.com" className="underline">
            mike@nuvoxel.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
