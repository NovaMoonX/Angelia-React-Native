import { Badge } from '@moondreamsdev/dreamer-ui/components';
import { useParams } from 'react-router-dom';
import { AppLinkLanding } from '@components/AppLinkLanding';
import { getInviteDeepLink } from '@/lib/appLinks';

export default function InviteRedirect() {
  const { channelId, inviteCode } = useParams();
  const normalizedInviteCode = inviteCode ? inviteCode.toUpperCase() : null;
  const deepLink = channelId && normalizedInviteCode
    ? getInviteDeepLink(channelId, normalizedInviteCode)
    : null;

  return (
    <AppLinkLanding
      title='You were invited to an Angelia Circle'
      subtitle='Open the app to send your join request and step into the Circle.'
      deepLink={deepLink}
    >
      {normalizedInviteCode ? (
        <div className='flex justify-center'>
          <Badge className='px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em]'>
            Invite Code: {normalizedInviteCode}
          </Badge>
        </div>
      ) : null}
    </AppLinkLanding>
  );
}