import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { isStatusActive } from '@/components/NowStatusBadge';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useUserIdentity } from '@/hooks/useUserIdentity';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { saveConnectionNickname } from '@/store/actions/connectionNicknameActions';
import { CONNECTION_NICKNAME_MAX_LENGTH } from '@/services/firebase/firestore';
import { getRelativeTime, formatTimeRemaining } from '@/lib/timeUtils';
import { getLegalFullName } from '@/lib/user/user.utils';
import type { User } from '@/models/types';

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null | undefined;
  /** When provided, shows a destructive "Disconnect" button at the bottom of the sheet. */
  onDisconnect?: () => Promise<void>;
  /** When true, shows the private nickname editor for this approved connection. */
  isConnection?: boolean;
}

export function UserProfileModal({
  visible,
  onClose,
  user,
  onDisconnect,
  isConnection = false,
}: UserProfileModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [savingNickname, setSavingNickname] = React.useState(false);
  const identity = useUserIdentity(user?.id, user ?? undefined);
  const existingNickname = useAppSelector((state) => {
    if (!user) return null;
    return state.connectionNicknames.nicknames[user.id] ?? null;
  });

  const [nicknameInput, setNicknameInput] = React.useState('');
  const [editingNickname, setEditingNickname] = React.useState(false);

  React.useEffect(() => {
    if (visible && user) {
      setNicknameInput(existingNickname ?? '');
      setEditingNickname(false);
    }
  }, [visible, user?.id, existingNickname]);

  if (!user) return null;

  const hasActiveStatus = isStatusActive(user.status);
  const showRealIdentity = identity.isSelf || identity.connected;
  const showNicknameEditor = isConnection && identity.connected && !isDemo;
  const legalName = getLegalFullName(user);
  const hasNickname = !!existingNickname?.trim();

  const handleSaveNickname = async () => {
    setSavingNickname(true);
    try {
      await dispatch(
        saveConnectionNickname({ targetUserId: user.id, nickname: nicknameInput }),
      ).unwrap();
      addToast({ type: 'success', title: hasNickname || nicknameInput.trim() ? 'Nickname saved' : 'Nickname cleared' });
      setEditingNickname(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to save nickname' });
    } finally {
      setSavingNickname(false);
    }
  };

  const handleClearNickname = async () => {
    setNicknameInput('');
    setSavingNickname(true);
    try {
      await dispatch(
        saveConnectionNickname({ targetUserId: user.id, nickname: '' }),
      ).unwrap();
      addToast({ type: 'success', title: 'Nickname cleared' });
      setEditingNickname(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to clear nickname' });
    } finally {
      setSavingNickname(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar + Name */}
            <View style={styles.profileHeader}>
              <Avatar
                preset={identity.avatarPreset}
                uri={identity.avatarUrl}
                user={showRealIdentity ? user : undefined}
                size="xl"
              />
              <Text style={[styles.name, { color: theme.foreground }]}>
                {identity.displayName}
              </Text>
              {showRealIdentity && hasNickname && legalName ? (
                <Text style={[styles.legalName, { color: theme.mutedForeground }]}>
                  Legal name: {legalName}
                </Text>
              ) : null}
              {!showRealIdentity && (
                <Text style={[styles.funFact, { color: theme.mutedForeground }]}>
                  Connect to see their full profile
                </Text>
              )}
              {showRealIdentity && user.funFact ? (
                <Text style={[styles.funFact, { color: theme.mutedForeground }]}>
                  💡 {user.funFact}
                </Text>
              ) : null}
            </View>

            {showNicknameEditor && (
              <View style={[styles.nicknameSection, { borderColor: theme.border }]}>
                <Label>Nickname</Label>
                <Text style={[styles.nicknameHint, { color: theme.mutedForeground }]}>
                  Only you can see this nickname
                </Text>
                {editingNickname || !hasNickname ? (
                  <>
                    <Input
                      value={nicknameInput}
                      onChangeText={setNicknameInput}
                      placeholder={legalName || 'Add a nickname'}
                      maxLength={CONNECTION_NICKNAME_MAX_LENGTH}
                      autoCapitalize="words"
                    />
                    <View style={styles.nicknameActions}>
                      <Button
                        size="sm"
                        loading={savingNickname}
                        onPress={handleSaveNickname}
                        disabled={!nicknameInput.trim() && !hasNickname}
                      >
                        Save
                      </Button>
                      {hasNickname ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={savingNickname}
                          onPress={handleClearNickname}
                        >
                          Clear
                        </Button>
                      ) : null}
                      {hasNickname ? (
                        <Button
                          size="sm"
                          variant="link"
                          onPress={() => {
                            setNicknameInput(existingNickname ?? '');
                            setEditingNickname(false);
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <View style={styles.nicknameDisplayRow}>
                    <Text style={[styles.nicknameValue, { color: theme.foreground }]}>
                      {existingNickname}
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => setEditingNickname(true)}
                    >
                      Edit
                    </Button>
                  </View>
                )}
              </View>
            )}

            {/* Status — prominent section */}
            {showRealIdentity && hasActiveStatus && (
              <View
                style={[styles.statusCard, { borderColor: theme.border }]}
              >
                <Text style={styles.statusEmoji}>{user.status?.emoji}</Text>
                <View style={styles.statusContent}>
                  <Text
                    style={[styles.statusText, { color: theme.foreground }]}
                  >
                    {user.status?.text}
                  </Text>
                  <Text
                    style={[styles.statusExpiry, { color: theme.mutedForeground }]}
                  >
                    {formatTimeRemaining(user.status?.expiresAt ?? 0)}
                  </Text>
                </View>
              </View>
            )}

            {showRealIdentity && !hasActiveStatus && (
              <View style={[styles.noStatus, { borderColor: theme.border }]}>
                <Text style={[styles.noStatusText, { color: theme.mutedForeground }]}>
                  No status set
                </Text>
              </View>
            )}

            {/* Meta info */}
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.mutedForeground }]}>
                Joined
              </Text>
              <Text style={[styles.metaValue, { color: theme.foreground }]}>
                {getRelativeTime(user.joinedAt)}
              </Text>
            </View>

            {onDisconnect && (
              <Button
                variant="destructive"
                size="sm"
                style={styles.disconnectButton}
                loading={disconnecting}
                onPress={async () => {
                  setDisconnecting(true);
                  try {
                    await onDisconnect();
                    onClose();
                  } catch {
                    // Only reset loading state on failure so the user can retry.
                    // On success onClose() is called immediately and the modal hides.
                    setDisconnecting(false);
                  }
                }}
              >
                Disconnect
              </Button>
            )}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  body: {
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  legalName: {
    fontSize: 13,
    textAlign: 'center',
  },
  funFact: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  nicknameSection: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  nicknameHint: {
    fontSize: 12,
    marginBottom: 4,
  },
  nicknameActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  nicknameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nicknameValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  statusEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  statusContent: {
    flex: 1,
    gap: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  statusExpiry: {
    fontSize: 12,
  },
  noStatus: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  noStatusText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  metaLabel: {
    fontSize: 13,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  disconnectButton: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
