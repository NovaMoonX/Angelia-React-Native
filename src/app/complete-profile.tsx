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
  const [invitedAnswer, setInvitedAnswer] = useState<'yes' | 'no' | null>(null);

  // Step 3
  const [categories, setCategories] = useState<Category[]>([]);
  const [familyStyle, setFamilyStyle] = useState<FamilyStyle | null>(null);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [customHobbies, setCustomHobbies] = useState<string[]>([]);
  const [customHobbyInput, setCustomHobbyInput] = useState('');
  const [selectedLifelogs, setSelectedLifelogs] = useState<string[]>([]);
  const [customLifelogs, setCustomLifelogs] = useState<string[]>([]);
  const [customLifelogInput, setCustomLifelogInput] = useState('');
  const [circleNameOverrides, setCircleNameOverrides] = useState<Record<string, string>>({});

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

  // ── Derived circle count ────────────────────────────────────────────────

  const totalPendingCircles =
    (categories.includes('family') && familyStyle ? 1 : 0) +
    selectedHobbies.length +
    customHobbies.length +
    selectedLifelogs.length +
    customLifelogs.length;
  const circlesAtMax = totalPendingCircles >= 3;

  // ── Derived list of circles to create ──────────────────────────────────

  const getPendingCircles = useCallback((): Array<{
    key: string;
    name: string;
    emoji: string;
    color: string;
    description: string;
  }> => {
    const circles: Array<{ key: string; name: string; emoji: string; color: string; description: string }> = [];

    if (categories.includes('family') && familyStyle) {
      const style = FAMILY_STYLES.find((s) => s.id === familyStyle);
      circles.push({
        key: `family:${familyStyle}`,
        name: style?.label ?? 'Family Circle',
        emoji: '💛',
        color: CHANNEL_COLORS[3].name,
        description: style?.desc ?? '',
      });
    }
    for (const h of selectedHobbies) {
      circles.push({
        key: `hobby:${h}`,
        name: `The ${h} Journal`,
        emoji: HOBBY_EMOJI[h] ?? '🎲',
        color: CHANNEL_COLORS[0].name,
        description: `A Circle for everything ${h.toLowerCase()}.`,
      });
    }
    customHobbies.forEach((h, i) => {
      circles.push({
        key: `hobby-custom:${i}`,
        name: `The ${h} Journal`,
        emoji: '✏️',
        color: CHANNEL_COLORS[0].name,
        description: `A Circle for everything ${h.toLowerCase()}.`,
      });
    });
    for (const l of selectedLifelogs) {
      circles.push({
        key: `lifelog:${l}`,
        name: l,
        emoji: l === 'Travel Log' ? '✈️' : '🏆',
        color: CHANNEL_COLORS[4].name,
        description: `My ${l.toLowerCase()} Circle.`,
      });
    }
    customLifelogs.forEach((l, i) => {
      circles.push({
        key: `lifelog-custom:${i}`,
        name: l,
        emoji: '📓',
        color: CHANNEL_COLORS[4].name,
        description: `My ${l.toLowerCase()} Circle.`,
      });
    });

    return circles.slice(0, 3);
  }, [categories, familyStyle, selectedHobbies, customHobbies, selectedLifelogs, customLifelogs]);

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

      // 3 — Create custom Circles (up to 3, from Step 3 selections)
      const pendingCircles = getPendingCircles();
      for (const circle of pendingCircles) {
        const name = (circleNameOverrides[circle.key] ?? circle.name).trim() || circle.name;
        try {
          await dispatch(createCustomChannel({ name, description: circle.description, color: circle.color })).unwrap();
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
      if (invitedAnswer === 'yes') {
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
        <Label>Choose Your Avatar</Label>
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
                { borderColor: avatar === preset ? theme.primary : 'transparent' },
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

  const renderStep2 = () => {
    const phase2Visible = invitedAnswer !== null;

    return (
      <>
        <StepHeader
          title="Have you been invited? 👋"
          subtitle="Did someone share a Circle invite with you?"
        />

        {/* YES / NO choice */}
        <View style={styles.yesNoRow}>
          <Pressable
            onPress={() => setInvitedAnswer('yes')}
            style={[
              styles.yesNoButton,
              {
                backgroundColor: invitedAnswer === 'yes' ? theme.primary : theme.card,
                borderColor: invitedAnswer === 'yes' ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.yesNoText,
                { color: invitedAnswer === 'yes' ? theme.primaryForeground : theme.foreground },
              ]}
            >
              ✅ Yes, I was invited
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setInvitedAnswer('no')}
            style={[
              styles.yesNoButton,
              {
                backgroundColor: invitedAnswer === 'no' ? theme.primary : theme.card,
                borderColor: invitedAnswer === 'no' ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.yesNoText,
                { color: invitedAnswer === 'no' ? theme.primaryForeground : theme.foreground },
              ]}
            >
              🚀 No, just exploring
            </Text>
          </Pressable>
        </View>

        {/* Phase 2 — revealed after answering */}
        {phase2Visible && (
          <>
            {invitedAnswer === 'yes' && (
              <View
                style={[
                  styles.bridgeCard,
                  { backgroundColor: theme.secondary, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.bridgeText, { color: theme.foreground }]}>
                  🎉 Once your space is set up, we'll take you straight to join your friend's Circle!
                </Text>
              </View>
            )}

            <View style={[styles.headerBlock, { marginTop: 16 }]}>
              <Text style={[styles.heading, { color: theme.foreground }]}>
                Now, let's set up your space!
              </Text>
              <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                Angelia gives you a Daily Circle automatically — your default space for everyday updates.
                You can also create custom Circles for specific groups and interests.
              </Text>
            </View>

            <Text style={[styles.infoText, { color: theme.mutedForeground, marginBottom: 16 }]}>
              We recommend setting up at least one Circle now, but you can always do it later.
            </Text>

            <View style={styles.ctaRow}>
              <Button
                variant="tertiary"
                onPress={() => animateTransition(() => setStep(4))}
                style={{ flex: 1 }}
              >
                Skip for now
              </Button>
              <Button onPress={goNext} style={{ flex: 1 }}>
                Set up my Circle →
              </Button>
            </View>
          </>
        )}
      </>
    );
  };

  const renderStep3 = () => {
    const showFamilySub = categories.includes('family');
    const showHobbySub = categories.includes('hobbies');
    const showLifelogSub = categories.includes('lifelog');
    const pendingCircles = getPendingCircles();

    const toggleHobby = (h: string) => {
      if (selectedHobbies.includes(h)) {
        setSelectedHobbies((prev) => prev.filter((x) => x !== h));
      } else if (!circlesAtMax) {
        setSelectedHobbies((prev) => [...prev, h]);
      }
    };

    const addCustomHobby = () => {
      const name = customHobbyInput.trim();
      if (!name || circlesAtMax || customHobbies.includes(name)) return;
      setCustomHobbies((prev) => [...prev, name]);
      setCustomHobbyInput('');
    };

    const removeCustomHobby = (idx: number) => {
      setCustomHobbies((prev) => prev.filter((_, i) => i !== idx));
    };

    const toggleLifelog = (l: string) => {
      if (selectedLifelogs.includes(l)) {
        setSelectedLifelogs((prev) => prev.filter((x) => x !== l));
      } else if (!circlesAtMax) {
        setSelectedLifelogs((prev) => [...prev, l]);
      }
    };

    const addCustomLifelog = () => {
      const name = customLifelogInput.trim();
      if (!name || circlesAtMax || customLifelogs.includes(name)) return;
      setCustomLifelogs((prev) => [...prev, name]);
      setCustomLifelogInput('');
    };

    const removeCustomLifelog = (idx: number) => {
      setCustomLifelogs((prev) => prev.filter((_, i) => i !== idx));
    };

    return (
      <>
        <StepHeader
          title="What do you want to share? 💬"
          subtitle="Create up to 3 custom Circles. Mix and match whatever fits you."
        />

        {/* 3-circle max indicator */}
        {circlesAtMax && (
          <View style={[styles.infoCallout, { backgroundColor: theme.secondary, borderColor: theme.border, marginBottom: 12 }]}>
            <Text style={[styles.infoCalloutText, { color: theme.foreground }]}>
              ✅ You've reached the 3-circle max. Remove a selection to add a different one.
            </Text>
          </View>
        )}

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
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
              FAMILY &amp; FRIENDS
            </Text>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              Does this sound like you?
            </Text>
            {FAMILY_STYLES.map((s) => (
              <OptionCard
                key={s.id}
                title={s.title}
                description={s.desc}
                selected={familyStyle === s.id}
                onPress={() => {
                  if (familyStyle === s.id) {
                    setFamilyStyle(null);
                  } else if (!circlesAtMax || familyStyle !== null) {
                    setFamilyStyle(s.id);
                  }
                }}
              />
            ))}
          </View>
        )}

        {/* Hobbies sub-options */}
        {showHobbySub && (
          <View style={styles.subSection}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>HOBBIES</Text>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              What are you into?
            </Text>
            <View style={styles.hobbyGrid}>
              {HOBBIES.map((h) => {
                const active = selectedHobbies.includes(h);
                const disabled = !active && circlesAtMax;
                return (
                  <Pressable
                    key={h}
                    onPress={() => toggleHobby(h)}
                    style={[
                      styles.hobbyChip,
                      {
                        backgroundColor: active ? theme.primary : theme.card,
                        borderColor: active ? theme.primary : theme.border,
                        opacity: disabled ? 0.4 : 1,
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
            </View>

            {/* Custom hobbies added */}
            {customHobbies.map((h, i) => (
              <View key={i} style={styles.customChipRow}>
                <Text style={[styles.customChipText, { color: theme.foreground }]}>
                  ✏️ {h}
                </Text>
                <Pressable onPress={() => removeCustomHobby(i)} hitSlop={8}>
                  <Text style={[styles.removeChipText, { color: theme.destructive }]}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add custom hobby */}
            {!circlesAtMax && (
              <View style={styles.customInputRow}>
                <Input
                  value={customHobbyInput}
                  onChangeText={setCustomHobbyInput}
                  placeholder="Add a custom hobby…"
                  autoCapitalize="words"
                  onSubmitEditing={addCustomHobby}
                  style={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  onPress={addCustomHobby}
                  disabled={!customHobbyInput.trim()}
                  style={{ marginLeft: 8 }}
                >
                  Add
                </Button>
              </View>
            )}
          </View>
        )}

        {/* Life Log sub-options */}
        {showLifelogSub && (
          <View style={styles.subSection}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>LIFE LOG</Text>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              What would you like to track?
            </Text>
            <Text style={[styles.infoText, { color: theme.mutedForeground }]}>
              You already have a Daily Circle for everyday updates. These are for a more specific focus. ☀️
            </Text>
            <View style={styles.hobbyGrid}>
              {LIFELOG_OPTIONS.map((opt) => {
                const active = selectedLifelogs.includes(opt);
                const disabled = !active && circlesAtMax;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => toggleLifelog(opt)}
                    style={[
                      styles.hobbyChip,
                      {
                        backgroundColor: active ? theme.primary : theme.card,
                        borderColor: active ? theme.primary : theme.border,
                        opacity: disabled ? 0.4 : 1,
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
            </View>

            {/* Custom lifelogs added */}
            {customLifelogs.map((l, i) => (
              <View key={i} style={styles.customChipRow}>
                <Text style={[styles.customChipText, { color: theme.foreground }]}>
                  📓 {l}
                </Text>
                <Pressable onPress={() => removeCustomLifelog(i)} hitSlop={8}>
                  <Text style={[styles.removeChipText, { color: theme.destructive }]}>✕</Text>
                </Pressable>
              </View>
            ))}

            {/* Add custom lifelog */}
            {!circlesAtMax && (
              <View style={styles.customInputRow}>
                <Input
                  value={customLifelogInput}
                  onChangeText={setCustomLifelogInput}
                  placeholder="Add a custom log…"
                  autoCapitalize="words"
                  onSubmitEditing={addCustomLifelog}
                  style={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  onPress={addCustomLifelog}
                  disabled={!customLifelogInput.trim()}
                  style={{ marginLeft: 8 }}
                >
                  Add
                </Button>
              </View>
            )}
          </View>
        )}

        {/* Circles preview panel */}
        {pendingCircles.length > 0 && (
          <View style={[styles.previewPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <Text style={[styles.previewHeader, { color: theme.mutedForeground }]}>
              CIRCLES TO CREATE ({pendingCircles.length}/3)
            </Text>
            {pendingCircles.map((circle) => (
              <View key={circle.key} style={styles.previewItem}>
                <Text style={styles.previewItemEmoji}>{circle.emoji}</Text>
                <Input
                  value={circleNameOverrides[circle.key] ?? circle.name}
                  onChangeText={(v) =>
                    setCircleNameOverrides((prev) => ({ ...prev, [circle.key]: v }))
                  }
                  style={{ flex: 1 }}
                />
              </View>
            ))}
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
          {' '}Angelia sends two gentle nudges a day so the people in your Circle know what you're up to — and because people want to know! We schedule them around your day so they feel natural, not intrusive. You can always turn them off later in{' '}
          <Text style={{ fontWeight: '700' }}>Settings → Notifications</Text>.
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
    borderWidth: 2,
    borderColor: 'transparent',
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  subHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },

  // YES / NO buttons (Step 2)
  yesNoRow: {
    gap: 12,
    marginBottom: 16,
  },
  yesNoButton: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  yesNoText: {
    fontSize: 16,
    fontWeight: '600',
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

  // Custom hobby/lifelog chip row (added items)
  customChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  customChipText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  removeChipText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Input + Add button row (custom entries)
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  // Circles preview panel (Step 3 bottom)
  previewPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  previewHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewItemEmoji: {
    fontSize: 20,
  },
});
