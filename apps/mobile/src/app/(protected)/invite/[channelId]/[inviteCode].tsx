import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InviteLegacyRedirectScreen() {
  const { channelId, inviteCode } = useLocalSearchParams<{
    channelId?: string;
    inviteCode?: string;
  }>();

  return (
    <Redirect
      href={{
        pathname: '/circle-invite-link',
        params: {
          channelId: channelId ?? '',
          inviteCode: inviteCode ?? '',
        },
      }}
    />
  );
}
