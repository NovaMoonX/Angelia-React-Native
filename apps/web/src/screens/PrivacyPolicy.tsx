import { Link } from 'react-router-dom';
import { AngeliaLogo } from '@components/AngeliaLogo';

const EFFECTIVE_DATE = 'May 7, 2026';
const CONTACT_EMAIL = 'hello@angelia.app';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-3'>
      <h2 className='text-2xl font-semibold text-foreground'>{title}</h2>
      <div className='space-y-3 text-foreground/80 leading-relaxed'>{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className='page flex flex-col items-center overflow-y-auto'>
      <div className='w-full max-w-3xl px-6 py-16 md:py-24 space-y-12'>
        {/* Header */}
        <header className='flex items-start justify-start'>
          <Link to='/' className='flex items-center gap-3 hover:opacity-80 transition-opacity'>
            <AngeliaLogo className='w-12 h-12 md:w-14 md:h-14' />
            <span className='text-2xl md:text-3xl font-bold text-foreground'>Angelia</span>
          </Link>
        </header>

        {/* Title */}
        <div className='space-y-3'>
          <h1 className='text-4xl md:text-5xl font-bold'>Privacy Policy</h1>
          <p className='text-foreground/60 text-sm'>Effective date: {EFFECTIVE_DATE}</p>
          <p className='text-foreground/80 leading-relaxed'>
            Angelia ("we", "us", or "our") is committed to protecting your privacy. This policy
            explains what information we collect, how we use it, and the choices you have.
          </p>
        </div>

        {/* Sections */}
        <Section title='1. Information We Collect'>
          <p>
            <strong>Account information.</strong> When you create an account we collect your name,
            email address, and profile photo (if provided).
          </p>
          <p>
            <strong>Content you create.</strong> Photos, videos, and text you post within your
            Circles are stored on our servers. You control who can see your content through Circle
            membership settings.
          </p>
          <p>
            <strong>Device information.</strong> We may collect your device type, operating system
            version, and a push-notification token to send you in-app notifications.
          </p>
          <p>
            <strong>Usage data.</strong> We collect basic analytics (e.g. feature usage, crash
            reports) to improve the app. This data is not linked to your identity.
          </p>
        </Section>

        <Section title='2. Camera and Microphone Access'>
          <p>
            Angelia requests access to your device's <strong>camera</strong> and{' '}
            <strong>microphone</strong> solely to let you capture photos and videos to share in your
            Circles. We do not record, transmit, or store any audio or video without your explicit
            action (e.g. tapping the record or capture button).
          </p>
          <p>
            Camera and microphone access is requested at the time you first attempt to use those
            features. You can revoke this permission at any time in your device's Settings without
            losing access to other parts of the app.
          </p>
        </Section>

        <Section title='3. Media Library Access'>
          <p>
            On Android 12 and earlier, Angelia requests read and write access to your device storage
            to let you select photos and videos from your gallery and to save media locally. On
            Android 13+, we request access only to photos and videos (not all files).
          </p>
          <p>We do not scan, read, or upload any file you have not explicitly selected.</p>
        </Section>

        <Section title='4. Notifications'>
          <p>
            Angelia uses push notifications (via Firebase Cloud Messaging) to alert you when someone
            joins your Circle, sends a connection request, or shares new content with you. You can
            disable notifications at any time in your device's Settings.
          </p>
        </Section>

        <Section title='5. How We Use Your Information'>
          <ul className='list-disc list-inside space-y-1'>
            <li>To provide, maintain, and improve the Angelia app.</li>
            <li>To send you notifications about activity in your Circles.</li>
            <li>To authenticate your account and keep it secure.</li>
            <li>To respond to support requests.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>
        </Section>

        <Section title='6. Third-Party Services'>
          <p>Angelia is built on Google Firebase, which provides:</p>
          <ul className='list-disc list-inside space-y-1'>
            <li>
              <strong>Firebase Authentication</strong> — secure sign-in.
            </li>
            <li>
              <strong>Cloud Firestore</strong> — structured data storage (posts, Circles, user
              profiles).
            </li>
            <li>
              <strong>Firebase Storage</strong> — media file hosting.
            </li>
            <li>
              <strong>Firebase Cloud Messaging</strong> — push notifications.
            </li>
          </ul>
          <p>
            Firebase's privacy practices are governed by Google's Privacy Policy:{' '}
            <a
              href='https://policies.google.com/privacy'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary underline underline-offset-2'
            >
              policies.google.com/privacy
            </a>
            .
          </p>
        </Section>

        <Section title='7. Data Sharing'>
          <p>We share your information only in the following limited circumstances:</p>
          <ul className='list-disc list-inside space-y-1'>
            <li>
              <strong>With other users</strong> — content you post is visible to members of your
              Circles as you configure.
            </li>
            <li>
              <strong>With service providers</strong> — Firebase (Google) processes data on our
              behalf under a data processing agreement.
            </li>
            <li>
              <strong>Legal requirements</strong> — if required by law or to protect our legal
              rights.
            </li>
          </ul>
        </Section>

        <Section title='8. Data Retention and Deletion'>
          <p>
            We retain your account data for as long as your account is active. When you delete your
            account, your profile, posts, and Circle memberships are permanently removed from our
            systems within 30 days.
          </p>
          <p>
            To request deletion of your data, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className='text-primary underline underline-offset-2'>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>
            Angelia is not directed at children under 13. We do not knowingly collect personal
            information from children under 13. If you believe we have inadvertently collected such
            information, please contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title='10. Changes to This Policy'>
          <p>
            We may update this policy from time to time. When we do, we will update the effective
            date at the top of this page and notify you through the app if the changes are
            significant.
          </p>
        </Section>

        <Section title='11. Contact Us'>
          <p>
            Questions or concerns about this privacy policy? Reach us at:
          </p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className='text-primary underline underline-offset-2'>
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        {/* Footer nav */}
        <div className='pt-4 border-t border-foreground/10'>
          <Link to='/' className='text-sm text-foreground/60 hover:text-foreground transition-colors'>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
