import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch } from '@/store/hooks';
import { createUserProfile } from '@/store/actions/userActions';
import { createDailyChannel, createCustomChannel } from '@/store/actions/channelActions';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { AVATAR_PRESETS, CHANNEL_COLORS } from '@/models/constants';
import type { AvatarPreset } from '@/models/types';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';

// ── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

type Category = 'family' | 'hobbies' | 'lifelog';

type FamilyStyle = 'new-parent' | 'grandparent' | 'long-distance' | 'inner-circle';

const FAMILY_STYLES: { id: FamilyStyle; title: string; label: string; desc: string }[] = [
  { id: 'new-parent', title: '👶 New Parent', label: 'New Parent', desc: 'I want to share milestones and tiny moments of my children.' },
  { id: 'grandparent', title: '🧡 Grandparent', label: 'Grandparent', desc: 'I want to stay in the loop and share my daily vibe.' },
  { id: 'long-distance', title: '🌍 Long Distance', label: 'Long Distance', desc: 'Staying close with people who are far away.' },
  { id: 'inner-circle', title: '🤝 Inner Circle', label: 'Inner Circle', desc: 'Just for my tight-knit group of friends.' },
];

const HOBBIES = [
  'Gaming', 'Reading', 'Fitness', 'Cooking/Food', 'Gardening',
  'DIY/Crafting', 'Art', 'Music', 'Tech/Coding', 'Writing',
  'Photography', 'Sports', 'Outdoors', 'Parenting', 'Pets',
] as const;

const HOBBY_EMOJI: Record<string, string> = {
  Gaming: '🎮', Reading: '📚', Fitness: '💪', 'Cooking/Food': '🍳', Gardening: '🌱',
  'DIY/Crafting': '🔨', Art: '🎨', Music: '🎵', 'Tech/Coding': '💻', Writing: '✍️',
  Photography: '📷', Sports: '⚽', Outdoors: '🏕️', Parenting: '👪', Pets: '🐾',
};

const LIFELOG_OPTIONS = ['Travel Log', 'Daily Win Tracker'] as const;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_DISPLAY = ['00', '15', '30', '45'];
const MINUTES_VALUES = [0, 15, 30, 45];

// ── Helpers ─────────────────────────────────────────────────────────────────

function to24(hour12: number, ampm: 'AM' | 'PM'): number {
  if (ampm === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function to12(h24: number): { hour: number; ampm: 'AM' | 'PM' } {
  if (h24 === 0) return { hour: 12, ampm: 'AM' };
  if (h24 < 12) return { hour: h24, ampm: 'AM' };
  if (h24 === 12) return { hour: 12, ampm: 'PM' };
  return { hour: h24 - 12, ampm: 'PM' };
}

function midpoint(startH: number, startM: number, endH: number, endM: number) {
  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  const mid = Math.round((startTotal + endTotal) / 2);
  const roundedMinute = Math.round((mid % 60) / 15) * 15;
  const extraHour = roundedMinute >= 60 ? 1 : 0;
  return { hour: (Math.floor(mid / 60) + extraHour) % 24, minute: roundedMinute % 60 };
}

function addMinutes(h: number, m: number, add: number) {
  const total = h * 60 + m + add;
  return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
}

function formatTime(h: number, m: number) {
  const { hour, ampm } = to12(h);
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { firebaseUser, sendVerificationEmail, signOut } = useAuth();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // ── Wizard state ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatar, setAvatar] = useState<AvatarPreset>('moon');

  // Step 2
  const [joinPath, setJoinPath] = useState<'join' | 'start' | null>(null);

  // Step 3
  const [categories, setCategories] = useState<Category[]>([]);
  const [familyStyle, setFamilyStyle] = useState<FamilyStyle | null>(null);
  const [selectedHobby, setSelectedHobby] = useState<string | null>(null);
  const [customHobby, setCustomHobby] = useState('');
  const [lifelogOption, setLifelogOption] = useState<string | null>(null);
  const [customLifelog, setCustomLifelog] = useState('');

  // Step 4
  const [busyFromHour, setBusyFromHour] = useState(9);
  const [busyFromMinute, setBusyFromMinute] = useState(0);
  const [busyFromAmPm, setBusyFromAmPm] = useState<'AM' | 'PM'>('AM');
  const [busyUntilHour, setBusyUntilHour] = useState(5);
  const [busyUntilMinute, setBusyUntilMinute] = useState(0);
  const [busyUntilAmPm, setBusyUntilAmPm] = useState<'AM' | 'PM'>('PM');

  // Step 4 — allow skipping with noon/6 PM defaults
  const [notifSkipped, setNotifSkipped] = useState(false);

  // Step 5
  const [firstPost, setFirstPost] = useState('');

  // ── Logout handler ──────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch {
      addToast({ type: 'error', title: 'Could not sign out. Please try again.' });
    }
  }, [signOut, router, addToast]);

  // ── Navigation helpers ──────────────────────────────────────────────────

  const animateTransition = useCallback(
    (next: () => void) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        next();
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim],
  );

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS) animateTransition(() => setStep((s) => s + 1));
  }, [step, animateTransition]);

  const goBack = useCallback(() => {
    if (step > 1) animateTransition(() => setStep((s) => s - 1));
  }, [step, animateTransition]);

  // ── Derived values for Step 4 ───────────────────────────────────────────

  const busyStart24 = to24(busyFromHour, busyFromAmPm);
  const busyEnd24 = to24(busyUntilHour, busyUntilAmPm);
  const midCheckIn = midpoint(busyStart24, busyFromMinute, busyEnd24, busyUntilMinute);
  const windDown = addMinutes(busyEnd24, busyUntilMinute, 30);

  // ── Derived custom Circle config ────────────────────────────────────────

  const resolveCustomCircle = useCallback((): { name: string; description: string; color: string } | null => {
    if (categories.includes('family') && familyStyle) {
      const style = FAMILY_STYLES.find((s) => s.id === familyStyle);
      return {
        name: style?.label ?? 'Family Circle',
        description: style?.desc ?? '',
        color: CHANNEL_COLORS[3].name, // PINK
      };
    }
    if (categories.includes('hobbies')) {
      const hobby = selectedHobby === 'custom' ? customHobby.trim() : selectedHobby;
      if (hobby) {
        return {
          name: `The ${hobby} Journal`,
          description: `A Circle for everything ${hobby.toLowerCase()}.`,
          color: CHANNEL_COLORS[0].name, // INDIGO
        };
      }
    }
    if (categories.includes('lifelog')) {
      const option = lifelogOption === 'custom' ? customLifelog.trim() : lifelogOption;
      if (option) {
        return {
          name: option,
          description: `My ${option.toLowerCase()} Circle.`,
          color: CHANNEL_COLORS[4].name, // LIME
        };
      }
    }
    return null;
  }, [categories, familyStyle, selectedHobby, customHobby, lifelogOption, customLifelog]);

  // ── Final submit ────────────────────────────────────────────────────────

  const handleFinish = async () => {
    if (!firebaseUser) return;

    setLoading(true);
    try {
      // 1 — Create user profile
      await dispatch(
        createUserProfile({
          id: firebaseUser.uid,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: firebaseUser.email ?? '',
          funFact: firstPost.trim(),
          avatar,
        }),
      ).unwrap();

      // 2 — Create daily Circle
      await dispatch(createDailyChannel(firebaseUser.uid)).unwrap();

      // 3 — Create custom Circle (if configured in Step 3)
      const circleConfig = resolveCustomCircle();
      if (circleConfig) {
        try {
          await dispatch(createCustomChannel(circleConfig)).unwrap();
        } catch {
          // Non-fatal: the user can create it later
        }
      }

      // 4 — Save notification settings
      try {
        const dailyHour = notifSkipped ? 12 : midCheckIn.hour;
        const dailyMinute = notifSkipped ? 0 : midCheckIn.minute;
        const windDownHour = notifSkipped ? 18 : windDown.hour;
        const windDownMinute = notifSkipped ? 0 : windDown.minute;
        await dispatch(
          saveNotificationSettings({
            dailyPrompt: { enabled: true, hour: dailyHour, minute: dailyMinute },
            windDownPrompt: { enabled: true, hour: windDownHour, minute: windDownMinute },
          }),
        ).unwrap();
      } catch {
        // Non-fatal: defaults will apply
      }

      // 5 — Verification email
      await sendVerificationEmail();

      addToast({ type: 'success', title: "You're all set! 🎉" });
      if (joinPath === 'join') {
        router.replace('/join-channel');
      } else {
        router.replace('/verify-email');
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Something went wrong — please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Toggle helpers for Step 3 ───────────────────────────────────────────

  const toggleCategory = (cat: Category) => {
    setCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 2) return prev;
      return [...prev, cat];
    });
  };

  // ── Reusable sub-components ─────────────────────────────────────────────

  const TopBar = () => (
    <View style={styles.topBar}>
      {/* Back (shown on steps 2+) */}
      {step > 1 ? (
        <Pressable onPress={goBack} style={styles.backButton} hitSlop={12}>
          <Text style={[styles.backText, { color: theme.primary }]}>← Back</Text>
        </Pressable>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}

      {/* Step progress dots */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: i < step ? theme.primary : theme.border },
            ]}
          />
        ))}
      </View>

      {/* Sign Out */}
      <Pressable onPress={handleLogout} hitSlop={12} style={styles.signOutButton}>
        <Text style={[styles.signOutText, { color: theme.mutedForeground }]}>Sign Out</Text>
      </Pressable>
    </View>
  );

  const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={styles.headerBlock}>
      <Text style={[styles.heading, { color: theme.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );

  // Card used in Step 2 & 3
  const OptionCard = ({
    title,
    description,
    selected,
    onPress,
  }: {
    title: string;
    description?: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? theme.primary : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.optionCardTitle,
          { color: selected ? theme.primaryForeground : theme.foreground },
        ]}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            styles.optionCardDesc,
            { color: selected ? theme.primaryForeground : theme.mutedForeground },
          ]}
        >
          {description}
        </Text>
      ) : null}
    </Pressable>
  );

  // Simple time-picker row (hour, minute, AM/PM) with selected time display
  const TimePicker = ({
    label,
    hour,
    minute,
    ampm,
    onHourChange,
    onMinuteChange,
    onAmPmChange,
  }: {
    label: string;
    hour: number;
    minute: number;
    ampm: 'AM' | 'PM';
    onHourChange: (h: number) => void;
    onMinuteChange: (m: number) => void;
    onAmPmChange: (v: 'AM' | 'PM') => void;
  }) => (
    <View style={styles.section}>
      <View style={styles.timePickerHeader}>
        <Label>{label}</Label>
        <Text style={[styles.selectedTimeDisplay, { color: theme.primary }]}>
          {hour}:{String(minute).padStart(2, '0')} {ampm}
        </Text>
      </View>
      <View style={styles.timeRow}>
        {/* Hour selector */}
        <View style={styles.timeGroup}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timePills}
          >
            {HOURS_12.map((h) => (
              <Pressable
                key={h}
                onPress={() => onHourChange(h)}
                style={[
                  styles.timePill,
                  {
                    backgroundColor: hour === h ? theme.primary : theme.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timePillText,
                    { color: hour === h ? theme.primaryForeground : theme.secondaryForeground },
                  ]}
                >
                  {h}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Minute selector */}
        <View style={[styles.timeGroup, { flex: 0 }]}>
          <View style={styles.timePills}>
            {MINUTES_VALUES.map((m, idx) => (
              <Pressable
                key={m}
                onPress={() => onMinuteChange(m)}
                style={[
                  styles.timePill,
                  {
                    backgroundColor: minute === m ? theme.primary : theme.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timePillText,
                    { color: minute === m ? theme.primaryForeground : theme.secondaryForeground },
                  ]}
                >
                  :{MINUTES_DISPLAY[idx]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AM / PM toggle */}
        <View style={[styles.timeGroup, { flex: 0 }]}>
          <View style={styles.timePills}>
            {(['AM', 'PM'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => onAmPmChange(v)}
                style={[
                  styles.timePill,
                  {
                    backgroundColor: ampm === v ? theme.primary : theme.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.timePillText,
                    { color: ampm === v ? theme.primaryForeground : theme.secondaryForeground },
                  ]}
                >
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  // ── Step renderers ──────────────────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <StepHeader
        title="Welcome to Angelia! ✨"
        subtitle="Let's get to know you."
      />

      {/* Name fields */}
      <View style={styles.section}>
        <Label>First Name</Label>
        <Input
          value={firstName}
          onChangeText={setFirstName}
          placeholder="What should we call you?"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.section}>
        <Label>Last Name</Label>
        <Input
          value={lastName}
          onChangeText={setLastName}
          placeholder="Your last name"
          autoCapitalize="words"
        />
      </View>

      {/* Avatar picker */}
      <View style={styles.section}>
        <Label>Pick Your Cosmic Avatar 🪐</Label>
        <View style={styles.avatarCurrent}>
          <Avatar preset={avatar} size="xl" />
        </View>
        <View style={styles.avatarGrid}>
          {AVATAR_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setAvatar(preset)}
              style={[
                styles.avatarOption,
                avatar === preset && {
                  borderColor: theme.primary,
                  borderWidth: 2,
                },
              ]}
            >
              <Avatar preset={preset} size="md" />
            </Pressable>
          ))}
        </View>
      </View>

      <Button
        onPress={() => {
          if (!firstName.trim() || !lastName.trim()) {
            addToast({ type: 'warning', title: 'We need your name to continue 💫' });
            return;
          }
          goNext();
        }}
        style={styles.cta}
      >
        Continue
      </Button>
    </>
  );

  const renderStep2 = () => (
    <>
      <StepHeader
        title="What brings you here? 🚀"
        subtitle="Are you here to join a friend's Circle or start your own?"
      />

      <OptionCard
        title="🤝 Join a friend's Circle"
        description="Someone invited me and I'm ready to hop in."
        selected={joinPath === 'join'}
        onPress={() => setJoinPath('join')}
      />

      <OptionCard
        title="🌟 Start my own"
        description="I want to create a space for my people."
        selected={joinPath === 'start'}
        onPress={() => setJoinPath('start')}
      />

      {joinPath === 'join' && (
        <View
          style={[
            styles.bridgeCard,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.bridgeText, { color: theme.foreground }]}>
            🎈 Let's set up your space first! Once you've finished, we'll take you straight to
            join your friend's Circle.
          </Text>
        </View>
      )}

      <Button
        onPress={goNext}
        disabled={!joinPath}
        style={styles.cta}
      >
        Continue
      </Button>
    </>
  );

  const renderStep3 = () => {
    const showFamilySub = categories.includes('family');
    const showHobbySub = categories.includes('hobbies');
    const showLifelogSub = categories.includes('lifelog');

    return (
      <>
        <StepHeader
          title="What do you want to share? 💬"
          subtitle="Pick up to 2 categories. We'll suggest a Circle for you."
        />

        {/* Category pills */}
        <View style={styles.pillRow}>
          {(
            [
              { id: 'family' as Category, label: '💛 Family & Friends' },
              { id: 'hobbies' as Category, label: '🎯 Hobbies' },
              { id: 'lifelog' as Category, label: '✨ Life Log' },
            ] as const
          ).map(({ id, label }) => {
            const active = categories.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => toggleCategory(id)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: active ? theme.primaryForeground : theme.foreground },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Family sub-options */}
        {showFamilySub && (
          <View style={styles.subSection}>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              What's your sharing style?
            </Text>
            {FAMILY_STYLES.map((s) => (
              <OptionCard
                key={s.id}
                title={s.title}
                description={s.desc}
                selected={familyStyle === s.id}
                onPress={() => { setFamilyStyle(familyStyle === s.id ? null : s.id); }}
              />
            ))}
          </View>
        )}

        {/* Hobbies sub-options */}
        {showHobbySub && (
          <View style={styles.subSection}>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              What are you into?
            </Text>
            <View style={styles.hobbyGrid}>
              {HOBBIES.map((h) => {
                const active = selectedHobby === h;
                return (
                  <Pressable
                    key={h}
                    onPress={() => setSelectedHobby(active ? null : h)}
                    style={[
                      styles.hobbyChip,
                      {
                        backgroundColor: active ? theme.primary : theme.card,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.hobbyChipText,
                        { color: active ? theme.primaryForeground : theme.foreground },
                      ]}
                    >
                      {HOBBY_EMOJI[h] ?? '🎲'} {h}
                    </Text>
                  </Pressable>
                );
              })}

              {/* "Something else" chip */}
              <Pressable
                onPress={() => setSelectedHobby(selectedHobby === 'custom' ? null : 'custom')}
                style={[
                  styles.hobbyChip,
                  {
                    backgroundColor: selectedHobby === 'custom' ? theme.primary : theme.card,
                    borderColor: selectedHobby === 'custom' ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.hobbyChipText,
                    {
                      color:
                        selectedHobby === 'custom' ? theme.primaryForeground : theme.foreground,
                    },
                  ]}
                >
                  ✏️ Something else…
                </Text>
              </Pressable>
            </View>

            {selectedHobby === 'custom' && (
              <Input
                value={customHobby}
                onChangeText={setCustomHobby}
                placeholder="Name your hobby"
                autoCapitalize="words"
              />
            )}

            {selectedHobby && selectedHobby !== 'custom' && (
              <Text style={[styles.suggestion, { color: theme.mutedForeground }]}>
                We'll create a Circle called "{`The ${selectedHobby} Journal`}" for you 📝
              </Text>
            )}
            {selectedHobby === 'custom' && customHobby.trim() && (
              <Text style={[styles.suggestion, { color: theme.mutedForeground }]}>
                We'll create a Circle called "{`The ${customHobby.trim()} Journal`}" for you 📝
              </Text>
            )}
          </View>
        )}

        {/* Life Log sub-options */}
        {showLifelogSub && (
          <View style={styles.subSection}>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              📓 Life Log
            </Text>
            <Text style={[styles.infoText, { color: theme.mutedForeground }]}>
              You already have a Daily Circle — that's your default spot for everyday updates.
              It's perfect for the small things. ☀️
            </Text>
            <Text style={[styles.infoText, { color: theme.foreground, marginTop: 8 }]}>
              Would you like a more specific space?
            </Text>

            {LIFELOG_OPTIONS.map((opt) => {
              const active = lifelogOption === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setLifelogOption(active ? null : opt)}
                  style={[
                    styles.hobbyChip,
                    {
                      backgroundColor: active ? theme.primary : theme.card,
                      borderColor: active ? theme.primary : theme.border,
                      alignSelf: 'flex-start',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hobbyChipText,
                      { color: active ? theme.primaryForeground : theme.foreground },
                    ]}
                  >
                    {opt === 'Travel Log' ? '✈️' : '🏆'} {opt}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setLifelogOption(lifelogOption === 'custom' ? null : 'custom')}
              style={[
                styles.hobbyChip,
                {
                  backgroundColor: lifelogOption === 'custom' ? theme.primary : theme.card,
                  borderColor: lifelogOption === 'custom' ? theme.primary : theme.border,
                  alignSelf: 'flex-start',
                },
              ]}
            >
              <Text
                style={[
                  styles.hobbyChipText,
                  {
                    color:
                      lifelogOption === 'custom' ? theme.primaryForeground : theme.foreground,
                  },
                ]}
              >
                ✏️ Custom…
              </Text>
            </Pressable>

            {lifelogOption === 'custom' && (
              <Input
                value={customLifelog}
                onChangeText={setCustomLifelog}
                placeholder="Name your Circle"
                autoCapitalize="words"
              />
            )}
          </View>
        )}

        <View style={styles.ctaRow}>
          <Button variant="tertiary" onPress={goNext} style={{ flex: 1 }}>
            Skip for now
          </Button>
          <Button onPress={goNext} style={{ flex: 1 }}>
            Continue
          </Button>
        </View>
      </>
    );
  };

  const renderStep4 = () => (
    <>
      <StepHeader
        title="When are you normally busy? ⏰"
        subtitle="We'll schedule gentle nudges around your day — one mid-day check-in, one evening wind-down."
      />

      {/* Why we ask */}
      <View
        style={[
          styles.infoCallout,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.infoCalloutText, { color: theme.foreground }]}>
          💡 <Text style={{ fontWeight: '700' }}>Why do we ask?</Text>
          {' '}Angelia sends two gentle nudges per day — one around the middle of your active hours and one as you wind down. Knowing your schedule means prompts feel natural, not intrusive.
        </Text>
      </View>

      <TimePicker
        label="Busy from"
        hour={busyFromHour}
        minute={busyFromMinute}
        ampm={busyFromAmPm}
        onHourChange={setBusyFromHour}
        onMinuteChange={setBusyFromMinute}
        onAmPmChange={setBusyFromAmPm}
      />

      <TimePicker
        label="Busy until"
        hour={busyUntilHour}
        minute={busyUntilMinute}
        ampm={busyUntilAmPm}
        onHourChange={setBusyUntilHour}
        onMinuteChange={setBusyUntilMinute}
        onAmPmChange={setBusyUntilAmPm}
      />

      <View
        style={[
          styles.bridgeCard,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.bridgeText, { color: theme.foreground }]}>
          🔔 We'll check in around{' '}
          <Text style={{ fontWeight: '700' }}>{formatTime(midCheckIn.hour, midCheckIn.minute)}</Text>
          {' '}and nudge you to wind down at{' '}
          <Text style={{ fontWeight: '700' }}>{formatTime(windDown.hour, windDown.minute)}</Text>.
        </Text>
      </View>

      <View style={styles.ctaRow}>
        <Button
          variant="tertiary"
          onPress={() => {
            setNotifSkipped(true);
            goNext();
          }}
          style={{ flex: 1 }}
        >
          Skip (noon & 6 PM)
        </Button>
        <Button
          onPress={() => {
            setNotifSkipped(false);
            goNext();
          }}
          style={{ flex: 1 }}
        >
          Looks good!
        </Button>
      </View>
    </>
  );

  const renderStep5 = () => (
    <>
      <StepHeader
        title="One last thing — let's break the ice! 🎉"
        subtitle="Your Daily Circle is set up and ready to go."
      />

      {/* Daily Circle explanation */}
      <View
        style={[
          styles.infoCallout,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.infoCalloutText, { color: theme.foreground }]}>
          ☀️ <Text style={{ fontWeight: '700' }}>What's your Daily Circle?</Text>
          {' '}It's your default space for everyday updates — the small stuff, the funny moments, the "you had to be there" things. Everyone who follows you will see it here.
        </Text>
      </View>

      <View style={styles.section}>
        <Label>Share your first update ✍️</Label>
        <Textarea
          value={firstPost}
          onChangeText={setFirstPost}
          placeholder="What's happening right now? A coffee? A sunset? A messy desk? 🤷‍♀️"
          rows={4}
          maxLength={300}
        />
      </View>

      <Text style={[styles.reassurance, { color: theme.mutedForeground }]}>
        Remember: it doesn't have to be perfect. If it matters to you, it's worth knowing for them. 💛
      </Text>

      <Button
        onPress={handleFinish}
        loading={loading}
        style={styles.cta}
      >
        Finish Setup 🚀
      </Button>
    </>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  const STEP_RENDERERS: Record<number, () => React.JSX.Element> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(40, insets.bottom + 24) }]}
        keyboardShouldPersistTaps="handled"
      >
        <TopBar />
        <Animated.View style={{ opacity: fadeAnim }}>
          {STEP_RENDERERS[step]()}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Top bar (progress + back + sign out)
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // Progress bar
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 28,
    height: 6,
    borderRadius: 3,
  },

  // Back
  backButton: {
    paddingVertical: 4,
    minWidth: 60,
  },
  backButtonPlaceholder: {
    minWidth: 60,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Sign out
  signOutButton: {
    paddingVertical: 4,
    alignItems: 'flex-end',
    minWidth: 60,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Headers
  headerBlock: {
    marginBottom: 20,
    gap: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Generic section
  section: {
    marginBottom: 20,
    gap: 8,
  },

  // Avatar
  avatarCurrent: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  avatarOption: {
    borderRadius: 24,
    padding: 4,
  },

  // Option cards (Step 2 & 3)
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  optionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionCardDesc: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Bridge card
  bridgeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  bridgeText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Category pills (Step 3)
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryPill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Sub-section
  subSection: {
    marginBottom: 20,
    gap: 10,
  },
  subHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },

  // Hobby chips
  hobbyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hobbyChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Suggestion text
  suggestion: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
  },

  // Info text
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Time picker
  timeRow: {
    gap: 10,
  },
  timeGroup: {
    flex: 1,
  },
  timePills: {
    flexDirection: 'row',
    gap: 6,
  },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 38,
    alignItems: 'center',
  },
  timePillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedTimeDisplay: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Info callout (Step 4 & 5)
  infoCallout: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  infoCalloutText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // CTA
  cta: {
    marginTop: 20,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },

  // Reassurance
  reassurance: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
});
