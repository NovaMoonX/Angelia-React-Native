import { useEffect, type ReactNode } from 'react';
import { Button } from '@moondreamsdev/dreamer-ui/components';
import { AngeliaLogo } from '@components/AngeliaLogo';

interface AppLinkLandingProps {
  title: string;
  subtitle: string;
  deepLink: string | null;
  children?: ReactNode;
}

export function AppLinkLanding({ title, subtitle, deepLink, children }: AppLinkLandingProps) {
  useEffect(() => {
    if (!deepLink) return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /iphone|ipad|android/.test(userAgent);
    if (!isMobileDevice) return;

    const timer = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [deepLink]);

  return (
    <div className='page flex min-h-screen items-center justify-center px-6 py-12'>
      <div className='w-full max-w-xl rounded-[2rem] border border-foreground/10 bg-background/95 p-8 text-center shadow-2xl backdrop-blur md:p-10'>
        <div className='mb-6 flex justify-center'>
          <AngeliaLogo className='h-18 w-18 md:h-20 md:w-20' />
        </div>

        <div className='space-y-4'>
          <h1 className='text-foreground text-3xl font-bold md:text-4xl'>{title}</h1>
          <p className='text-foreground/70 mx-auto max-w-lg text-base leading-relaxed md:text-lg'>
            {subtitle}
          </p>
        </div>

        {children ? <div className='mt-6'>{children}</div> : null}

        <div className='mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center'>
          {deepLink ? (
            <Button href={deepLink} size='lg' className='sm:min-w-52'>
              Open in Angelia
            </Button>
          ) : null}
          <Button href='/about' variant='secondary' size='lg' className='sm:min-w-52'>
            Learn More
          </Button>
        </div>

        <p className='text-foreground/50 mt-6 text-sm leading-6'>
          If the app did not pop open, keep this page handy and tap the button again after you install Angelia.
        </p>
      </div>
    </div>
  );
}