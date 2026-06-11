import { Redirect, useLocalSearchParams } from 'expo-router';

/** Public deep-link entry for angelia://invite/{channelId}/{inviteCode} */
export default function InviteDeepLinkScreen() {
  const { channelId, inviteCode } = useLocalSearchParams<{
    channelId: string;
    inviteCode: string;
  }>();

  return (
    <Redirect
      href={{
        pathname: '/circle-invite-link',
        params: { channelId, inviteCode },
      }}
    />
  );
}
