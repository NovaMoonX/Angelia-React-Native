import { Link } from 'react-router-dom';
import { AngeliaLogo } from '@components/AngeliaLogo';

const CONTACT_EMAIL = 'angelia-support@moondreams.dev';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-3'>
      <h2 className='text-2xl font-semibold text-foreground'>{title}</h2>
      <div className='space-y-3 text-foreground/80 leading-relaxed'>{children}</div>
    </section>
  );
}

export default function DataDeletion() {
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
          <h1 className='text-4xl md:text-5xl font-bold'>Data Deletion Request</h1>
          <p className='text-foreground/80 leading-relaxed'>
            You have the right to request deletion of your Angelia account and the personal data
            associated with it. This page explains how to submit a request and exactly what happens
            when we process it.
          </p>
        </div>

        {/* Delete account */}
        <Section title='How to Request Account Deletion'>
          <p>
            To request full deletion of your Angelia account and all associated data, send an email
            to:
          </p>
          <div className='rounded-lg border border-foreground/10 bg-foreground/[0.03] p-4 space-y-1'>
            <p className='font-medium text-foreground'>Email</p>
            <p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Account Deletion Request`}
                className='text-primary underline underline-offset-2'
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className='text-sm text-foreground/60'>
              Subject: <strong>Account Deletion Request</strong> — include the email address
              associated with your Angelia account. We will process your request within{' '}
              <strong>30 days</strong>.
            </p>
          </div>
        </Section>

        {/* What is deleted */}
        <Section title='What Data Is Deleted'>
          <p>
            When your account is deleted, the following data is <strong>permanently removed</strong>{' '}
            from our systems within <strong>30 days</strong>:
          </p>
          <ul className='list-disc list-inside space-y-1'>
            <li>Your profile (name, email address, profile photo, bio)</li>
            <li>All posts and media (photos, videos) you have shared in any Circle</li>
            <li>All private messages and conversations</li>
            <li>Your Circle memberships and any Circles you hosted</li>
            <li>Connection relationships with other users</li>
            <li>Push notification tokens linked to your account</li>
            <li>Any feedback or support submissions</li>
          </ul>
        </Section>

        {/* Specific data deletion */}
        <Section title='Requesting Deletion of Specific Data Only'>
          <p>
            If you want to remove specific content — such as a post or message — without deleting
            your full account, email us with the details of what you'd like removed:
          </p>
          <div className='rounded-lg border border-foreground/10 bg-foreground/[0.03] p-4 space-y-1'>
            <p className='font-medium text-foreground'>Email</p>
            <p>
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Data Deletion Request`}
                className='text-primary underline underline-offset-2'
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className='text-sm text-foreground/60'>
              Subject: <strong>Data Deletion Request</strong> — describe the specific content you'd
              like deleted and include the email address on your account. We will respond within{' '}
              <strong>30 days</strong>.
            </p>
          </div>
          <p className='text-sm text-foreground/50 italic'>
            In a future update, users will be able to delete individual posts and messages directly
            within the app.
          </p>
        </Section>

        {/* What is kept */}
        <Section title='Data That May Be Retained'>
          <p>
            After deletion, we may retain the following for a limited period as required by law or
            for legitimate business purposes:
          </p>
          <ul className='list-disc list-inside space-y-1'>
            <li>
              <strong>Anonymized analytics</strong> — aggregate, non-identifiable usage data that
              cannot be linked back to you (retained indefinitely).
            </li>
            <li>
              <strong>Legal hold data</strong> — if your account is subject to an active legal
              investigation or obligation, relevant records may be retained until that obligation is
              resolved.
            </li>
          </ul>
          <p>
            We do <strong>not</strong> retain your name, email, profile content, or any
            identifiable information after the 30-day deletion window has passed.
          </p>
        </Section>

        {/* Footer nav */}
        <div className='pt-4 border-t border-foreground/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <Link to='/' className='text-sm text-foreground/60 hover:text-foreground transition-colors'>
            ← Back to Home
          </Link>
          <Link
            to='/privacy-policy'
            className='text-sm text-foreground/60 hover:text-foreground transition-colors'
          >
            Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
