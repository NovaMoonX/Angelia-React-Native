import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import { submitFeedback } from '@/services/firebase/firestore';
import { generateId } from '@/utils/generateId';
import { CopyButton } from '@/components/ui/CopyButton';
import type { FeedbackCategory } from '@/models/types';

// ── Constants ────────────────────────────────────────────────────────────────

const SUPPORT_EMAIL = 'angelia-support@moondreams.dev';

interface CategoryOption {
  value: FeedbackCategory;
  label: string;
  emoji: string;
  subcategories: string[];
}

const CATEGORIES: CategoryOption[] = [
  {
    value: 'bug',
    label: 'Bug Report',
    emoji: '🐛',
    subcategories: [
      'App crash',
      'Something not working',
      'Content looks wrong',
      'Performance issue',
      'Other',
    ],
  },
  {
    value: 'feature_request',
    label: 'Feature Request',
    emoji: '✨',
    subcategories: [
      'Circle features',
      'Posts & media',
      'Notifications',
      'Account & profile',
      'Other',
    ],
  },
  {
    value: 'circles',
    label: 'Circle Feedback',
    emoji: '🔵',
    subcategories: [
      'My Circles',
      'Finding people',
      'Joining Circles',
      'Other',
    ],
  },
  {
    value: 'posts',
    label: 'Posts & Media',
    emoji: '📝',
    subcategories: [
      'Creating posts',
      'Viewing posts',
      'Photos & videos',
      'Post tiers',
      'Other',
    ],
  },
  {
    value: 'notifications',
    label: 'Notifications',
    emoji: '🔔',
    subcategories: [
      'Not receiving notifications',
      'Too many notifications',
      'Wrong notification content',
      'Notification settings',
      'Other',
    ],
  },
  {
    value: 'account',
    label: 'Account & Profile',
    emoji: '👤',
    subcategories: [
      'Sign in / sign out',
      'Profile settings',
      'Notifications settings',
      'Privacy concern',
      'Other',
    ],
  },
  {
    value: 'other',
    label: 'General Feedback',
    emoji: '💬',
    subcategories: [],
  },
];

// ── Types ────────────────────────────────────────────────────────────────────

type FlowType = 'feedback' | 'support';
type Step = 'pick_flow' | 'pick_category' | 'pick_subcategory' | 'write_text' | 'support_info';

interface FeedbackSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FeedbackSupportModal({ visible, onClose }: FeedbackSupportModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { addToast } = useToast();

  const currentUser = useAppSelector((state) => state.users.currentUser);

  const [flow, setFlow] = useState<FlowType | null>(null);
  const [step, setStep] = useState<Step>('pick_flow');
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  // Track keyboard height on Android (modals are exempt from adjustPan)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setAndroidKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Reset whenever modal opens
  useEffect(() => {
    if (!visible) return;
    setFlow(null);
    setStep('pick_flow');
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setText('');
    setSubmitting(false);
  }, [visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePickFlow = useCallback((picked: FlowType) => {
    setFlow(picked);
    setStep(picked === 'feedback' ? 'pick_category' : 'support_info');
  }, []);

  const handlePickCategory = useCallback((cat: CategoryOption) => {
    setSelectedCategory(cat);
    setStep(cat.subcategories.length > 0 ? 'pick_subcategory' : 'write_text');
  }, []);

  const handlePickSubcategory = useCallback((sub: string) => {
    setSelectedSubcategory(sub);
    setStep('write_text');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'pick_category') {
      setStep('pick_flow');
      setFlow(null);
    } else if (step === 'pick_subcategory') {
      setStep('pick_category');
      setSelectedSubcategory(null);
    } else if (step === 'write_text') {
      if (selectedCategory && selectedCategory.subcategories.length > 0) {
        setStep('pick_subcategory');
      } else {
        setStep('pick_category');
      }
      setText('');
    } else if (step === 'support_info') {
      setStep('pick_flow');
      setFlow(null);
    }
  }, [step, selectedCategory]);

  const handleSubmit = useCallback(async () => {
    if (!currentUser || !selectedCategory || !text.trim()) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        id: generateId('nano'),
        userId: currentUser.id,
        userEmail: currentUser.email,
        category: selectedCategory.value,
        subcategory: selectedSubcategory,
        text: text.trim(),
        createdAt: Date.now(),
      });
      addToast({ type: 'success', title: '🙌 Thanks for your feedback!' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Could not send feedback. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }, [currentUser, selectedCategory, selectedSubcategory, text, addToast, onClose]);

  const handleEmailSupport = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderHeader = (title: string) => (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      {step !== 'pick_flow' ? (
        <Pressable onPress={handleBack} hitSlop={8} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: theme.mutedForeground }]}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
      <Pressable onPress={handleClose} hitSlop={8}>
        <Text style={[styles.closeBtn, { color: theme.mutedForeground }]}>✕</Text>
      </Pressable>
    </View>
  );

  const renderPickFlow = () => (
    <>
      {renderHeader('Get Help')}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
          What can we help you with?
        </Text>
        <Pressable
          onPress={() => handlePickFlow('feedback')}
          style={[styles.flowCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={styles.flowEmoji}>💬</Text>
          <View style={styles.flowText}>
            <Text style={[styles.flowTitle, { color: theme.foreground }]}>Share Feedback</Text>
            <Text style={[styles.flowDesc, { color: theme.mutedForeground }]}>
              Report a bug, suggest a feature, or share thoughts about the app.
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => handlePickFlow('support')}
          style={[styles.flowCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <Text style={styles.flowEmoji}>🛟</Text>
          <View style={styles.flowText}>
            <Text style={[styles.flowTitle, { color: theme.foreground }]}>Contact Support</Text>
            <Text style={[styles.flowDesc, { color: theme.mutedForeground }]}>
              Need direct help? Reach our team by email.
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </>
  );

  const renderPickCategory = () => (
    <>
      {renderHeader("What's this about?")}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
          Choose a category
        </Text>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.value}
            onPress={() => handlePickCategory(cat)}
            style={[styles.categoryRow, { borderColor: theme.border }]}
          >
            <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: theme.foreground }]}>{cat.label}</Text>
            <Text style={[styles.chevron, { color: theme.mutedForeground }]}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  const renderPickSubcategory = () => (
    <>
      {renderHeader(selectedCategory?.label ?? 'More detail')}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
          What's the specific issue?
        </Text>
        {selectedCategory?.subcategories.map((sub) => (
          <Pressable
            key={sub}
            onPress={() => handlePickSubcategory(sub)}
            style={[styles.categoryRow, { borderColor: theme.border }]}
          >
            <Text style={[styles.categoryLabel, { color: theme.foreground }]}>{sub}</Text>
            <Text style={[styles.chevron, { color: theme.mutedForeground }]}>›</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            setSelectedSubcategory(null);
            setStep('write_text');
          }}
          style={[styles.categoryRow, { borderColor: theme.border }]}
        >
          <Text style={[styles.categoryLabel, { color: theme.mutedForeground }]}>
            Skip — just describe it
          </Text>
          <Text style={[styles.chevron, { color: theme.mutedForeground }]}>›</Text>
        </Pressable>
      </ScrollView>
    </>
  );

  const renderWriteText = () => {
    const placeholder =
      selectedCategory?.value === 'bug'
        ? 'Describe what happened and how to reproduce it\u2026'
        : selectedCategory?.value === 'feature_request'
          ? 'Tell us what you\'d like to see\u2026'
          : 'Describe your feedback\u2026';

    return (
      <>
        {renderHeader('Describe it')}
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {selectedSubcategory ? (
            <View style={[styles.subPill, { backgroundColor: theme.muted }]}>
              <Text style={[styles.subPillText, { color: theme.mutedForeground }]}>
                {selectedCategory?.emoji} {selectedCategory?.label} · {selectedSubcategory}
              </Text>
            </View>
          ) : selectedCategory ? (
            <View style={[styles.subPill, { backgroundColor: theme.muted }]}>
              <Text style={[styles.subPillText, { color: theme.mutedForeground }]}>
                {selectedCategory.emoji} {selectedCategory.label}
              </Text>
            </View>
          ) : null}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={theme.mutedForeground}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
            style={[
              styles.textInput,
              {
                color: theme.foreground,
                backgroundColor: theme.background,
                borderColor: theme.border,
              },
            ]}
            autoFocus
          />
          <Text style={[styles.charCount, { color: theme.mutedForeground }]}>
            {text.length}/1000
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={!text.trim() || submitting}
            style={[
              styles.submitBtn,
              {
                backgroundColor: text.trim() && !submitting ? theme.primary : theme.muted,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
                Send Feedback
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </>
    );
  };

  const renderSupportInfo = () => (
    <>
      {renderHeader('Contact Support')}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.supportCard, { backgroundColor: theme.muted, borderColor: theme.border }]}>
          <Text style={styles.supportEmoji}>🛟</Text>
          <Text style={[styles.supportHeading, { color: theme.foreground }]}>
            We're here to help!
          </Text>
          <Text style={[styles.supportBody, { color: theme.mutedForeground }]}>
            Send us an email and our team will get back to you as soon as possible.
            Please include your account email and a description of what you need help with.
          </Text>
        </View>

        <Pressable
          onPress={handleEmailSupport}
          style={[styles.emailBtn, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.emailBtnText, { color: theme.primaryForeground }]}>
            📧 Email Support
          </Text>
        </Pressable>

        <View style={styles.emailRow}>
          <Text style={[styles.emailAddress, { color: theme.mutedForeground }]}>
            {SUPPORT_EMAIL}
          </Text>
          <CopyButton
            textToCopy={SUPPORT_EMAIL}
            variant="tertiary"
            size="sm"
          >
            Copy
          </CopyButton>
        </View>

        <Pressable
          onPress={() => handlePickFlow('feedback')}
          style={styles.feedbackLink}
        >
          <Text style={[styles.feedbackLinkText, { color: theme.primary }]}>
            Want to share feedback instead? →
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );

  const renderStep = () => {
    switch (step) {
      case 'pick_flow': return renderPickFlow();
      case 'pick_category': return renderPickCategory();
      case 'pick_subcategory': return renderPickSubcategory();
      case 'write_text': return renderWriteText();
      case 'support_info': return renderSupportInfo();
    }
  };

  const sheetBottomPadding =
    Platform.OS === 'android' && androidKeyboardHeight > 0
      ? androidKeyboardHeight + 16
      : insets.bottom + 16;

  const sheet = (
    <Pressable
      style={styles.backdrop}
      onPress={text.trim() ? undefined : handleClose}
    >
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.card,
            paddingBottom: sheetBottomPadding,
          },
        ]}
        onStartShouldSetResponder={() => true}
      >
        {renderStep()}
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.keyboardAvoid} behavior="padding">
          {sheet}
        </KeyboardAvoidingView>
      ) : sheet}
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  backBtnText: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
  },
  closeBtn: {
    fontSize: 20,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  // Flow cards (pick_flow step)
  flowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 14,
  },
  flowEmoji: {
    fontSize: 28,
  },
  flowText: {
    flex: 1,
    gap: 4,
  },
  flowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  flowDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Category / subcategory rows
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  categoryEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  categoryLabel: {
    flex: 1,
    fontSize: 15,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },
  // Subcategory pill shown in write_text step
  subPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  subPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Text input
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -4,
  },
  submitBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Support info step
  supportCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  supportEmoji: {
    fontSize: 36,
  },
  supportHeading: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  supportBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emailBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emailAddress: {
    fontSize: 13,
  },
  feedbackLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  feedbackLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
