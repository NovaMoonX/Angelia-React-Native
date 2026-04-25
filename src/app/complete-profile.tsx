import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import QRCode from 'react-native-qrcode-svg';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createUserProfile } from '@/store/actions/userActions';
import { createDailyChannel, createCustomChannel } from '@/store/actions/channelActions';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { createInviteCircleTask, createSetFunFactTask, createSetStatusTask, createCustomCircleTask, createMakeFirstPostTask } from '@/store/actions/taskActions';
import { uploadUserAvatar } from '@/services/firebase/storage';
import { AVATAR_PRESETS, CHANNEL_COLORS } from '@/models/constants';
import type { AvatarPreset } from '@/models/types';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';

// ── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

type Category = 'family' | 'hobbies' | 'lifelog';

type FamilyStyle = 'new-parent' | 'grandparent' | 'long-distance' | 'immediate-family' | 'inner-circle';

const FAMILY_STYLES: { id: FamilyStyle; title: string; label: string; desc: string }[] = [
  { id: 'new-parent', title: '👶 New Parent', label: 'New Parent', desc: 'I want to share milestones and tiny moments of my child(ren).' },
  { id: 'grandparent', title: '🧡 Grandparent', label: 'Grandparent', desc: 'I want to stay connected and share what life looks like these days.' },
  { id: 'long-distance', title: '🌍 Long Distance', label: 'Long Distance', desc: 'Staying close with people who are far away.' },
  { id: 'immediate-family', title: '🏡 Immediate Family', label: 'Immediate Family', desc: 'Staying in sync with the people closest to home.' },
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

const LIFELOG_OPTIONS = ['Travel Log', 'Daily Wins', 'Career Journey', 'Fitness Journey'] as const;

const LIFELOG_EMOJI: Record<string, string> = {
  'Travel Log': '✈️',
  'Daily Wins': '🏆',
  'Career Journey': '💼',
  'Fitness Journey': '🏋️',
};

const DEFAULT_LIFELOG_EMOJI = '📓';

const CIRCLE_LIMIT_WARNING = "You've hit the 3-circle limit. Remove an existing one to add a different one.";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_DISPLAY = ['00', '15', '30', '45'];
const MINUTES_VALUES = [0, 15, 30, 45];

// ── Helpers ─────────────────────────────────────────────────────────────────

function randomChannelColor(): string {
  return CHANNEL_COLORS[Math.floor(Math.random() * CHANNEL_COLORS.length)].name;
}

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

function oneThirdPoint(startH: number, startM: number, endH: number, endM: number) {
  const startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;
  if (endTotal <= startTotal) endTotal += 24 * 60;
  const third = startTotal + Math.floor((endTotal - startTotal) / 3);
  const minute = Math.floor((third % 60) / 30) * 30; // round down to nearest 30 min
  return { hour: Math.floor(third / 60) % 24, minute };
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

  // If the user arrived here from "Join a Circle" on the home screen, a
  // pending invite channel will be in Redux.  We use this to skip the
  // YES/NO invited question and go straight to the acknowledgement screen.
  const pendingInviteChannel = useAppSelector((state) => state.pendingInvite.channel);

  // ── Wizard state ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatar, setAvatar] = useState<AvatarPreset>('moon');
  /** Local file URI of a custom photo picked during sign-up. Uploaded in handleFinish. */
  const [avatarPhotoUri, setAvatarPhotoUri] = useState<string | null>(null);

  // Step 2 — if a pending invite exists we already know the answer is "yes"
  const [invitedAnswer, setInvitedAnswer] = useState<'yes' | 'no' | null>(
    pendingInviteChannel ? 'yes' : null,
  );
  // When there's a pending invite we skip phase 1 (the YES/NO question) and
  // go directly to phase 2 (the "you'll be added after setup" acknowledgement).
  const [step2Phase, setStep2Phase] = useState<1 | 2 | 3>(
    pendingInviteChannel ? 2 : 1,
  );

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
  const [activeFromHour, setActiveFromHour] = useState(8);
  const [activeFromMinute, setActiveFromMinute] = useState(0);
  const [activeFromAmPm, setActiveFromAmPm] = useState<'AM' | 'PM'>('AM');
  const [activeUntilHour, setActiveUntilHour] = useState(10);
  const [activeUntilMinute, setActiveUntilMinute] = useState(0);
  const [activeUntilAmPm, setActiveUntilAmPm] = useState<'AM' | 'PM'>('PM');

  // Step 4 — allow skipping with noon/6 PM defaults
  const [notifSkipped, setNotifSkipped] = useState(false);

  // Step 5 — Connection Bridge
  const [showQrModal, setShowQrModal] = useState(false);
  const [hasSharedConnection, setHasSharedConnection] = useState(false);

  // Step 6 (was Step 5)
  const [firstPost, setFirstPost] = useState('');
  const [showSkipPostModal, setShowSkipPostModal] = useState(false);

  // Step 2 — Phase 2: skip space setup confirmation
  const [showSkipSpaceModal, setShowSkipSpaceModal] = useState(false);

  // ── Logout handler ──────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch {
      addToast({ type: 'error', title: 'Could not sign out. Please try again.' });
    }
  }, [signOut, router, addToast]);

  // ── Avatar photo picker (Step 1) ─────────────────────────────────────────

  const handlePickAvatarPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      addToast({ type: 'warning', title: 'Photo library access is needed to upload an avatar.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      setAvatarPhotoUri(compressed.uri);
    } catch {
      setAvatarPhotoUri(result.assets[0].uri);
    }
  }, [addToast]);

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
    if (step === 2 && step2Phase === 3) {
      animateTransition(() => setStep2Phase(invitedAnswer === 'yes' ? 2 : 1));
    } else if (step === 2 && step2Phase === 2) {
      // If the user came via "Join a Circle" there is no phase 1 — go back to step 1.
      if (pendingInviteChannel) {
        animateTransition(() => setStep((s) => s - 1));
      } else {
        animateTransition(() => setStep2Phase(1));
      }
    } else if (step === 3) {
      animateTransition(() => { setStep(2); setStep2Phase(3); });
    } else if (step > 1) {
      animateTransition(() => setStep((s) => s - 1));
    }
  }, [step, step2Phase, animateTransition, pendingInviteChannel]);

  // ── Derived values for Step 4 ───────────────────────────────────────────

  const activeStart24 = to24(activeFromHour, activeFromAmPm);
  const activeEnd24 = to24(activeUntilHour, activeUntilAmPm);
  const midCheckIn = oneThirdPoint(activeStart24, activeFromMinute, activeEnd24, activeUntilMinute);
  const windDown = addMinutes(activeEnd24, activeUntilMinute, -60);

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
        color: randomChannelColor(),
        description: style?.desc ?? '',
      });
    }
    for (const h of selectedHobbies) {
      circles.push({
        key: `hobby:${h}`,
        name: `The ${h} Journal`,
        emoji: HOBBY_EMOJI[h] ?? '🎲',
        color: randomChannelColor(),
        description: `A Circle for everything ${h.toLowerCase()}.`,
      });
    }
    customHobbies.forEach((h, i) => {
      circles.push({
        key: `hobby-custom:${i}`,
        name: `The ${h} Journal`,
        emoji: '🎯',
        color: randomChannelColor(),
        description: `A Circle for everything ${h.toLowerCase()}.`,
      });
    });
    for (const l of selectedLifelogs) {
      circles.push({
        key: `lifelog:${l}`,
        name: l,
        emoji: LIFELOG_EMOJI[l] ?? DEFAULT_LIFELOG_EMOJI,
        color: randomChannelColor(),
        description: `My ${l.toLowerCase()} Circle.`,
      });
    }
    customLifelogs.forEach((l, i) => {
      circles.push({
        key: `lifelog-custom:${i}`,
        name: l,
        emoji: DEFAULT_LIFELOG_EMOJI,
        color: randomChannelColor(),
        description: `My ${l.toLowerCase()} Circle.`,
      });
    });

    return circles.slice(0, 3);
  }, [categories, familyStyle, selectedHobbies, customHobbies, selectedLifelogs, customLifelogs]);

  // ── Final submit ────────────────────────────────────────────────────────

  /** Minimum time (ms) each loading step is shown so the user can read it. */
  const MIN_STEP_MS = 800;
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const handleFinish = async () => {
    if (!firebaseUser) return;

    setLoading(true);
    setLoadingMessage('Getting everything ready for you ✨');
    try {
      // 1 — Upload custom avatar photo if one was selected (non-fatal)
      let uploadedAvatarUrl: string | undefined;
      if (avatarPhotoUri) {
        try {
          uploadedAvatarUrl = await uploadUserAvatar(firebaseUser.uid, avatarPhotoUri);
        } catch {
          // Non-fatal: fall back to preset avatar, but let the user know
          addToast({ type: 'warning', title: "Couldn't upload your photo — we'll use the emoji avatar for now. You can change it later in settings." });
        }
      }

      // 2 — Create user profile
      await dispatch(
        createUserProfile({
          id: firebaseUser.uid,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: firebaseUser.email ?? '',
          funFact: firstPost.trim(),
          avatar,
          avatarUrl: uploadedAvatarUrl ?? null,
        }),
      ).unwrap();

      // 3 — Create daily Circle
      setLoadingMessage('Building your Daily Circle 🌙');
      await Promise.all([dispatch(createDailyChannel(firebaseUser.uid)).unwrap(), sleep(MIN_STEP_MS)]);

      // 4 — Create custom Circles (up to 3, from Step 3 selections)
      const pendingCircles = getPendingCircles();
      if (pendingCircles.length > 0) {
        setLoadingMessage('Setting up your custom Circles 💫');
        await sleep(MIN_STEP_MS);
      }
      for (const circle of pendingCircles) {
        const name = (circleNameOverrides[circle.key] ?? circle.name).trim() || circle.name;
        try {
          const createdChannel = await dispatch(createCustomChannel({ name, description: circle.description, color: circle.color })).unwrap();
          // Create a task reminding the user to invite someone to each new Circle
          if (createdChannel) {
            try {
              await dispatch(createInviteCircleTask({ channelId: createdChannel.id, channelName: createdChannel.name })).unwrap();
            } catch {
              // Non-fatal: task creation failure shouldn't block sign-up
            }
          }
        } catch {
          // Non-fatal: the user can create it later
        }
      }

      // 5 — Create nudge tasks (non-fatal, all in parallel)
      setLoadingMessage('Setting up your to-do list 📋');
      await Promise.all([
        sleep(MIN_STEP_MS),
        // Nudge to fill in their fun fact if they skipped it during onboarding
        !firstPost.trim()
          ? dispatch(createSetFunFactTask()).unwrap().catch(() => null)
          : Promise.resolve(null),
        // Nudge to set first status — everyone starts without one
        dispatch(createSetStatusTask()).unwrap().catch(() => null),
        // Nudge to create a custom circle if they opted out during onboarding
        pendingCircles.length === 0
          ? dispatch(createCustomCircleTask()).unwrap().catch(() => null)
          : Promise.resolve(null),
        // Task to make their first post — always created for new users
        dispatch(createMakeFirstPostTask()).unwrap().catch(() => null),
      ]);

      // 6 — Save notification settings
      try {
        // If skipped, default to 12:30 PM (1/3 of way through an 8am–10pm day) and 9 PM (1hr before 10pm)
        const dailyHour = notifSkipped ? 12 : midCheckIn.hour;
        const dailyMinute = notifSkipped ? 30 : midCheckIn.minute;
        const windDownHour = notifSkipped ? 21 : windDown.hour;
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

      // 7 — Verification email
      setLoadingMessage('Almost there — sending your verification email 💌');
      await Promise.all([sendVerificationEmail(), sleep(MIN_STEP_MS)]);

      addToast({ type: 'success', title: "You're all set! 🎉" });
      if (invitedAnswer === 'yes') {
        router.replace({ pathname: '/join-channel', params: { fromOnboarding: '1' } });
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
      setLoadingMessage('');
    }
  };

  // ── Toggle helpers for Step 3 ───────────────────────────────────────────

  const toggleCategory = (cat: Category) => {
    setCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      return [...prev, cat];
    });
  };

  const removePendingCircle = useCallback((key: string) => {
    if (key.startsWith('family:')) {
      setFamilyStyle(null);
    } else if (key.startsWith('hobby:')) {
      const h = key.slice('hobby:'.length);
      setSelectedHobbies((prev) => prev.filter((x) => x !== h));
    } else if (key.startsWith('hobby-custom:')) {
      const idx = parseInt(key.slice('hobby-custom:'.length), 10);
      setCustomHobbies((prev) => prev.filter((_, i) => i !== idx));
    } else if (key.startsWith('lifelog:')) {
      const l = key.slice('lifelog:'.length);
      setSelectedLifelogs((prev) => prev.filter((x) => x !== l));
    } else if (key.startsWith('lifelog-custom:')) {
      const idx = parseInt(key.slice('lifelog-custom:'.length), 10);
      setCustomLifelogs((prev) => prev.filter((_, i) => i !== idx));
    }
    setCircleNameOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

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
          <Avatar preset={avatar} uri={avatarPhotoUri} size="xl" />
        </View>

        {/* Photo upload option */}
        <View style={styles.photoUploadRow}>
          <Button variant="outline" onPress={handlePickAvatarPhoto} style={{ flex: 1 }}>
            {avatarPhotoUri ? '📷 Change Photo' : '📷 Upload a Photo'}
          </Button>
          {avatarPhotoUri ? (
            <Button
              variant="tertiary"
              onPress={() => setAvatarPhotoUri(null)}
              style={{ flex: 1 }}
            >
              Remove Photo
            </Button>
          ) : null}
        </View>

        {/* Emoji preset grid — shown only when no photo is selected */}
        {!avatarPhotoUri && (
          <>
            <Text style={[styles.orDivider, { color: theme.mutedForeground }]}>— or pick an emoji —</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => { setAvatar(preset); setAvatarPhotoUri(null); }}
                  style={[
                    styles.avatarOption,
                    { borderColor: avatar === preset ? theme.primary : 'transparent' },
                  ]}
                >
                  <Avatar preset={preset} size="md" />
                </Pressable>
              ))}
            </View>
          </>
        )}
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
    // Phase 1 — just the YES / NO question
    // Skipped entirely when the user arrived via "Join a Circle" on the home
    // screen (pendingInviteChannel is set), because we already know they have
    // an invite.
    if (step2Phase === 1) {
      return (
        <>
          <StepHeader
            title="Have you been invited? 👋"
            subtitle="Did someone share a Circle invite with you?"
          />

          <View style={styles.yesNoRow}>
            <Pressable
              onPress={() => { setInvitedAnswer('yes'); animateTransition(() => setStep2Phase(2)); }}
              style={[
                styles.yesNoButton,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.yesNoText, { color: theme.foreground }]}>
                ✅ Yes, I was invited
              </Text>
            </Pressable>

            <Pressable
              onPress={() => { setInvitedAnswer('no'); animateTransition(() => setStep2Phase(3)); }}
              style={[
                styles.yesNoButton,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.yesNoText, { color: theme.foreground }]}>
                🚀 No, just exploring
              </Text>
            </Pressable>
          </View>
        </>
      );
    }

    // Phase 2 — prominent "You're invited!" acknowledgement (yes path only)
    if (step2Phase === 2) {
      // When the user came from "Join a Circle" on the home screen we can
      // reference the specific Circle they're joining.
      // Daily circles show "their Daily Circle" rather than the raw name "Daily".
      const circleName = pendingInviteChannel
        ? (pendingInviteChannel.isDaily ? 'their Daily Circle' : pendingInviteChannel.name)
        : null;
      const circleRef = circleName
        ? (
          <>
            {' '}to join{' '}
            <Text style={{ fontWeight: '700', color: theme.primary }}>
              {circleName}
            </Text>
          </>
        )
        : ' to join a Circle on Angelia';

      return (
        <View style={styles.invitedHero}>
          <Text style={styles.invitedEmoji}>🎉</Text>
          <Text style={[styles.invitedHeroTitle, { color: theme.foreground }]}>
            You're in!
          </Text>
          <Text style={[styles.invitedHeroBody, { color: theme.mutedForeground }]}>
            You've been invited{circleRef}.{' '}
            <Text style={{ fontWeight: '700', color: theme.foreground }}>
              Once you finish setting up your profile, you'll be taken right to it.
            </Text>
          </Text>

          <View
            style={[
              styles.invitedHeroCallout,
              { backgroundColor: theme.secondary, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.bridgeText, { color: theme.foreground }]}>
              💡 Your space is separate from theirs — it's yours to own and share with whoever you choose.
            </Text>
          </View>

          <Button
            onPress={() => animateTransition(() => setStep2Phase(3))}
            style={styles.invitedHeroCta}
            size="lg"
          >
            Let's set up your space →
          </Button>

          <Button
            variant="tertiary"
            onPress={() => setShowSkipSpaceModal(true)}
            style={styles.invitedHeroSkip}
          >
            Skip — take me to join their Circle
          </Button>

          <Modal
            isOpen={showSkipSpaceModal}
            onClose={() => setShowSkipSpaceModal(false)}
            title="Skip setting up your space?"
          >
            <Text style={[styles.infoCalloutText, { color: theme.foreground, marginBottom: 16 }]}>
              Your{' '}
              <Text style={{ fontWeight: '700', color: theme.primary }}>Daily Circle</Text>
              {' '}will still be created automatically — but you won't set up any custom Circles right now. You can always do that later from the app.
            </Text>
            <Text style={[styles.infoCalloutText, { color: theme.mutedForeground, marginBottom: 20 }]}>
              We'll take you straight to the Circle you were invited to after the last step. 🎉
            </Text>
            <Button
              onPress={() => setShowSkipSpaceModal(false)}
              style={{ marginBottom: 12 }}
            >
              Set up my space
            </Button>
            <Button
              variant="tertiary"
              onPress={() => {
                setShowSkipSpaceModal(false);
                animateTransition(() => setStep(4));
              }}
            >
              Skip for now
            </Button>
          </Modal>
        </View>
      );
    }

    // Phase 3 — space setup explanation
    return (
      <View style={styles.spaceSetupHero}>
        {/* Centered hero content */}
        <View style={styles.spaceSetupHeroCenter}>
          <Text style={styles.spaceSetupEmoji}>🏡</Text>
          <Text style={[styles.invitedHeroTitle, { color: theme.foreground }]}>
            Let's set up your space!
          </Text>
          <Text style={[styles.invitedHeroBody, { color: theme.mutedForeground }]}>
            Angelia gives you a{' '}
            <Text style={{ fontWeight: '700', color: theme.primary }}>Daily Circle</Text>
            {' '}automatically — your default space for everyday updates.{'\n\n'}
            You can also create up to{' '}
            <Text style={{ fontWeight: '700', color: theme.foreground }}>3 custom Circles</Text>
            {' '}for specific groups and interests.
          </Text>

          <Button onPress={goNext} style={styles.invitedHeroCta} size="lg">
            Set up my Circle →
          </Button>
          <Button
            variant="tertiary"
            onPress={() => animateTransition(() => setStep(4))}
            style={styles.invitedHeroSkip}
          >
            Skip for now
          </Button>
        </View>

        {/* What's a Circle? — anchored at the bottom */}
        <View style={[styles.bridgeCard, styles.spaceSetupFooter, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Text style={[styles.bridgeText, { color: theme.mutedForeground }]}>
            💬 <Text style={{ fontWeight: '700', color: theme.foreground }}>What's a Circle?</Text>
            {' '}A small, private group where you share updates with people who actually care — family, friends, or whoever you choose. No feeds, no strangers.
          </Text>
        </View>
      </View>
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
      } else if (circlesAtMax) {
        addToast({ type: 'warning', title: CIRCLE_LIMIT_WARNING });
      } else {
        setSelectedHobbies((prev) => [...prev, h]);
      }
    };

    const addCustomHobby = () => {
      const name = customHobbyInput.trim();
      if (!name) return;
      if (circlesAtMax) {
        addToast({ type: 'warning', title: CIRCLE_LIMIT_WARNING });
        return;
      }
      if (customHobbies.includes(name)) return;
      setCustomHobbies((prev) => [...prev, name]);
      setCustomHobbyInput('');
    };

    const removeCustomHobby = (idx: number) => {
      setCustomHobbies((prev) => prev.filter((_, i) => i !== idx));
    };

    const toggleLifelog = (l: string) => {
      if (selectedLifelogs.includes(l)) {
        setSelectedLifelogs((prev) => prev.filter((x) => x !== l));
      } else if (circlesAtMax) {
        addToast({ type: 'warning', title: CIRCLE_LIMIT_WARNING });
      } else {
        setSelectedLifelogs((prev) => [...prev, l]);
      }
    };

    const addCustomLifelog = () => {
      const name = customLifelogInput.trim();
      if (!name) return;
      if (circlesAtMax) {
        addToast({ type: 'warning', title: CIRCLE_LIMIT_WARNING });
        return;
      }
      if (customLifelogs.includes(name)) return;
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
          subtitle="Pick categories below, then choose what fits you. You can mix all three!"
        />

        <Text style={[styles.infoText, { color: theme.mutedForeground, marginBottom: 12 }]}>
          You can create up to{' '}
          <Text style={{ fontWeight: '700', color: theme.foreground }}>3 custom Circles in total</Text>
          {' '}across all categories. Your{' '}
          <Text style={{ fontWeight: '700', color: theme.primary }}>Daily Circle</Text>
          {' '}is separate and created automatically.
        </Text>

        {/* 3-circle max indicator */}
        {circlesAtMax && (
          <View style={[styles.infoCallout, { backgroundColor: theme.secondary, borderColor: theme.border, marginBottom: 12 }]}>
            <Text style={[styles.infoCalloutText, { color: theme.foreground }]}>
              ✅ You've reached the 3-circle max. Remove a selection to add a different one.
            </Text>
          </View>
        )}

        {/* Categories section header */}
        <View style={[styles.subSection, !circlesAtMax ? { marginTop: 8 } : null]}>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
            CATEGORIES
          </Text>
          <Text style={[styles.subHeader, { color: theme.foreground }]}>
            Which of these resonates with you?
          </Text>
          <Text style={[styles.infoText, { color: theme.mutedForeground }]}>
            Choose what feels applicable to you. You can select all 3 categories if they all align with who you are.
          </Text>
        </View>

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
              FAMILY & FRIENDS
            </Text>
            <Text style={[styles.subHeader, { color: theme.foreground }]}>
              Does this sound like you?
            </Text>
            {FAMILY_STYLES.map((s) => {
              const isSelected = familyStyle === s.id;
              const isDisabled = !isSelected && circlesAtMax;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    if (isSelected) {
                      setFamilyStyle(null);
                    } else if (isDisabled) {
                      addToast({ type: 'warning', title: CIRCLE_LIMIT_WARNING });
                    } else {
                      setFamilyStyle(s.id);
                    }
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.card,
                      borderColor: isSelected ? theme.primary : theme.border,
                      opacity: isDisabled ? 0.4 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionCardTitle,
                      { color: isSelected ? theme.primaryForeground : theme.foreground },
                    ]}
                  >
                    {s.title}
                  </Text>
                  <Text
                    style={[
                      styles.optionCardDesc,
                      { color: isSelected ? theme.primaryForeground : theme.mutedForeground },
                    ]}
                  >
                    {s.desc}
                  </Text>
                </Pressable>
              );
            })}
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

              {/* Custom hobbies — rendered as pills in the same grid */}
              {customHobbies.map((h, i) => (
                <Pressable
                  key={`custom-${i}`}
                  onPress={() => removeCustomHobby(i)}
                  style={[
                    styles.hobbyChip,
                    {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    },
                  ]}
                >
                  <Text style={[styles.hobbyChipText, { color: theme.primaryForeground }]}>
                    🎯 {h}
                  </Text>
                  <Text style={[styles.hobbyChipText, { color: theme.primaryForeground, fontWeight: '700' }]}>✕</Text>
                </Pressable>
              ))}
            </View>

            {/* Add custom hobby */}
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
              Your{' '}
              <Text style={{ fontWeight: '700', color: theme.primary }}>Daily Circle</Text>
              {' '}handles everyday updates. These are for a more specific focus.
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
                      {LIFELOG_EMOJI[opt] ?? DEFAULT_LIFELOG_EMOJI} {opt}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Custom lifelogs — rendered as pills in the same grid */}
              {customLifelogs.map((l, i) => (
                <Pressable
                  key={`custom-${i}`}
                  onPress={() => removeCustomLifelog(i)}
                  style={[
                    styles.hobbyChip,
                    {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    },
                  ]}
                >
                  <Text style={[styles.hobbyChipText, { color: theme.primaryForeground }]}>
                    🎯 {l}
                  </Text>
                  <Text style={[styles.hobbyChipText, { color: theme.primaryForeground, fontWeight: '700' }]}>✕</Text>
                </Pressable>
              ))}
            </View>

            {/* Add custom lifelog */}
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
          </View>
        )}

        {/* Circles preview panel */}
        {pendingCircles.length > 0 && (
          <View style={[styles.previewPanel, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={styles.previewPanelHeader}>
              <Text style={[styles.previewHeader, { color: theme.mutedForeground }]}>
                CIRCLES TO CREATE ({pendingCircles.length}/3)
              </Text>
              <Text style={[styles.previewHelpText, { color: theme.mutedForeground }]}>
                Tap a circle to rename it
              </Text>
            </View>
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
                <Pressable onPress={() => removePendingCircle(circle.key)} hitSlop={8} style={styles.previewItemRemove}>
                  <Text style={[styles.removeChipText, { color: theme.mutedForeground }]}>✕</Text>
                </Pressable>
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
        title="When are you normally active? ⏰"
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
          <Text style={{ fontWeight: '700' }}>Notifications → Settings</Text>.
        </Text>
      </View>

      <TimePicker
        label="Active from"
        hour={activeFromHour}
        minute={activeFromMinute}
        ampm={activeFromAmPm}
        onHourChange={setActiveFromHour}
        onMinuteChange={setActiveFromMinute}
        onAmPmChange={setActiveFromAmPm}
      />

      <TimePicker
        label="Active until"
        hour={activeUntilHour}
        minute={activeUntilMinute}
        ampm={activeUntilAmPm}
        onHourChange={setActiveUntilHour}
        onMinuteChange={setActiveUntilMinute}
        onAmPmChange={setActiveUntilAmPm}
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
          Skip
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

      <Text style={[styles.reassurance, { color: theme.mutedForeground }, { marginTop: 10}]}>
        If you skip, we'll default to 12:30 PM & 9 PM. You can always change this in{' '}
        <Text style={{ fontWeight: '700' }}>Notifications → Settings</Text>.
      </Text>
    </>
  );

  const renderStep5 = () => {
    const connectionLink = `angelia://connect-request?from=${firebaseUser?.uid ?? ''}`;
    const displayName = `${firstName.trim() || 'You'} ${lastName.trim()}`.trim();

    const handleShareLink = async () => {
      try {
        await Share.share({
          message: `Connect with me on Angelia! 🤝\n\n${connectionLink}`,
          url: Platform.OS === 'ios' ? connectionLink : undefined,
          title: `Connect with ${firstName.trim() || 'me'} on Angelia`,
        });
        setHasSharedConnection(true);
      } catch {
        // User cancelled — no-op
      }
    };

    return (
      <>
        <StepHeader
          title="Bring your people in. 🤝"
          subtitle="Angelia works best with a small, trusted group. Share your connection link — when someone taps it, they'll send you a request to connect."
        />

        {/* Handshake card */}
        <View style={[styles.handshakeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Avatar preset={avatar} uri={avatarPhotoUri} size="xl" />
          <Text style={[styles.handshakeName, { color: theme.foreground }]}>{displayName}</Text>

          <Pressable onPress={() => setShowQrModal(true)} style={styles.qrWrapper}>
            <QRCode
              value={connectionLink}
              size={140}
              color={theme.foreground}
              backgroundColor={theme.card}
            />
            <Text style={[styles.qrTapHint, { color: theme.mutedForeground }]}>Tap to enlarge</Text>
          </Pressable>
        </View>

        <Button onPress={handleShareLink} style={styles.cta} size="lg">
          Share Connection Link
        </Button>
        {hasSharedConnection && (
          <Button
            variant='outline'
            onPress={goNext}
            style={{ marginTop: 10 }}
            size="lg"
          >
            Done
          </Button>
        )}
        <Button
          variant="tertiary"
          onPress={goNext}
          style={{ marginTop: 6 }}
        >
          I'll do this later
        </Button>

        {/* QR code full-screen overlay */}
        <RNModal
          visible={showQrModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowQrModal(false)}
        >
          <Pressable
            style={styles.qrOverlay}
            onPress={() => setShowQrModal(false)}
          >
            <View
              style={[styles.qrModalCard, { backgroundColor: theme.card }]}
              onStartShouldSetResponder={() => true}
            >
              <Avatar preset={avatar} uri={avatarPhotoUri} size="lg" />
              <Text style={[styles.handshakeName, { color: theme.foreground }]}>{displayName}</Text>
              <QRCode
                value={connectionLink}
                size={220}
                color={theme.foreground}
                backgroundColor={theme.card}
              />
              <Text style={[styles.qrTapHint, { color: theme.mutedForeground }]}>
                Point a camera here to connect
              </Text>
              <Button variant="outline" onPress={() => setShowQrModal(false)} style={{ marginTop: 8 }}>
                Close
              </Button>
            </View>
          </Pressable>
        </RNModal>
      </>
    );
  };

  const renderStep6 = () => (
    <>
      <StepHeader
        title="Almost there! Let's make it personal. 🌟"
        subtitle="Share a fun fact about yourself — something most people probably don't know."
      />

      <View style={styles.section}>
        <Label>Your fun fact ✍️</Label>
        <Textarea
          value={firstPost}
          onChangeText={setFirstPost}
          placeholder="Something surprising, quirky, or totally unexpected about you 🤔"
          rows={4}
          maxLength={300}
        />
      </View>

      <Text style={[styles.reassurance, { color: theme.mutedForeground }]}>
        This shows up on your profile and is a great conversation starter. 💛
      </Text>

      <Button
        onPress={handleFinish}
        loading={loading}
        style={styles.cta}
      >
        Finish Setup 🚀
      </Button>

      <Button
        variant="tertiary"
        onPress={() => setShowSkipPostModal(true)}
        style={{ marginTop: 12 }}
      >
        Skip fun fact
      </Button>

      {/* Skip fun fact confirmation modal */}
      <Modal
        isOpen={showSkipPostModal}
        onClose={() => setShowSkipPostModal(false)}
        title="Skip your fun fact?"
      >
        <Text style={[styles.infoCalloutText, { color: theme.foreground, marginBottom: 16 }]}>
          A fun fact is a great way to let people get to know the real you — something they'd never guess! It's a small touch that makes your profile feel personal and memorable. 🌟
        </Text>
        <Text style={[styles.infoCalloutText, { color: theme.mutedForeground, marginBottom: 20 }]}>
          No worries — you can always add one later from your profile.
        </Text>
        <Button onPress={() => setShowSkipPostModal(false)} style={{ marginBottom: 12 }}>
          Add a fun fact
        </Button>
        <Button
          variant="tertiary"
          onPress={() => {
            setShowSkipPostModal(false);
            handleFinish();
          }}
        >
          Skip for now
        </Button>
      </Modal>
    </>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  const STEP_RENDERERS: Record<number, () => React.JSX.Element> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
    6: renderStep6,
  };

  // Show a full-screen loading overlay while the finish sequence runs
  if (loading && loadingMessage) {
    return (
      <View style={[styles.loadingOverlay, { backgroundColor: theme.background }]}>
        <Text style={styles.loadingEmoji}>✨</Text>
        <Text style={[styles.loadingHeading, { color: theme.foreground }]}>
          Prepping your space…
        </Text>
        <Text style={[styles.loadingMessage, { color: theme.mutedForeground }]}>
          {loadingMessage}
        </Text>
      </View>
    );
  }

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

  // Loading overlay (shown during handleFinish)
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  loadingHeading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
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
  photoUploadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 10,
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
  previewPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  previewHelpText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewItemEmoji: {
    fontSize: 20,
  },
  previewItemRemove: {
    paddingHorizontal: 4,
  },

  // Step 5 — Connection Bridge
  handshakeCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  handshakeName: {
    fontSize: 18,
    fontWeight: '700',
  },
  qrWrapper: {
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  qrTapHint: {
    fontSize: 12,
  },
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: 300,
  },

  // Step 2 — Phase 2: Invited hero screen
  invitedHero: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 8,
  },
  invitedEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  invitedHeroTitle: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  invitedHeroBody: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 24,
  },
  invitedHeroCallout: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    width: '100%',
  },
  invitedHeroCta: {
    marginTop: 32,
    width: '100%',
  },
  invitedHeroSkip: {
    marginTop: 12,
    width: '100%',
  },

  // Step 2 — Phase 3: space setup hero
  spaceSetupHero: {
    flex: 1,
    paddingHorizontal: 8,
  },
  spaceSetupHeroCenter: {
    alignItems: 'center',
    paddingTop: 24,
  },
  spaceSetupEmoji: {
    fontSize: 72,
    marginBottom: 16,
    textAlign: 'center',
  },
  spaceSetupFooter: {
    marginTop: 40,
  },
});
