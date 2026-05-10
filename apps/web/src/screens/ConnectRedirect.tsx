import { useSearchParams } from 'react-router-dom';
import { AppLinkLanding } from '@components/AppLinkLanding';
import { getConnectionDeepLink } from '@/lib/appLinks';

export default function ConnectRedirect() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const deepLink = from ? getConnectionDeepLink(from) : null;

  return (
    <AppLinkLanding
      title='Someone wants to connect on Angelia'
      subtitle='Open the app to send or respond to a connection request in the right place.'
      deepLink={deepLink}
    />
  );
}