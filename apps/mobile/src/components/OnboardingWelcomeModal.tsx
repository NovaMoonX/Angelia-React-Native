import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAppSelector } from '@/store/hooks';
import { selectCurrentUserCustomChannels } from '@/store/crossSelectors/channelSelectors';
import { useTheme } from '@/hooks/useTheme';
import { CUSTOM_POST_RETENTION_DAYS, DAILY_POST_RETENTION_DAYS, ONBOARDING_FEED_GUIDE_STATE_KEY } from '@/models/constants';

interface GuideStep {
  emoji: string;
  title: string;
  body: string;
}

export function OnboardingWelcomeModal() {
  const { theme } = useTheme();
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const customChannels = useAppSelector(selectCurrentUserCustomChannels);
  const customCircleCount = customChannels.length;

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!currentUser || isDemo) {
      setIsOpen(false);
      return () => {};
    }

    AsyncStorage.getItem(ONBOARDING_FEED_GUIDE_STATE_KEY(currentUser.id))
      .then((value) => {
        if (cancelled) return;
        // Show if never seen (null) or explicitly pending — only hide if dismissed
        setIsOpen(value !== 'dismissed');
      })
      .catch(() => {
        if (cancelled) return;
        setIsOpen(false);
      });

    return () => { cancelled = true; };
  }, [currentUser, isDemo]);

  const handleDismiss = useCallback(async () => {
    setIsOpen(false);
    if (!currentUser) return;
    try {
      await AsyncStorage.setItem(ONBOARDING_FEED_GUIDE_STATE_KEY(currentUser.id), 'dismissed');
    } catch {
      // Best-effort
    }
  }, [currentUser]);

  const steps = useMemo((): GuideStep[] => {
    const nextSteps: GuideStep[] = [
      {
        emoji: '🌞',
        title: 'Your Daily Circle is your easy lane',
        body: `Use it for the tiny life updates. Daily Circle posts fade away after ${DAILY_POST_RETENTION_DAYS} days, so sharing stays light.`,
      },
      {
        emoji: '🫶',
        title: 'Small posts are perfect here',
        body: 'You do not need a polished update. A quick photo, a sentence, or a random little moment is exactly the vibe.',
      },
    ];

    if (customCircleCount > 0) {
      nextSteps.push({
        emoji: '🎯',
        title: 'Custom Circles give each thing its own space',
        body: `Use them when a person, project, or part of life deserves its own lane. Those posts stick around for ${CUSTOM_POST_RETENTION_DAYS} days.`,
      });
    }

    nextSteps.push({
      emoji: '🔒',
      title: 'You are still in control of the room',
      body: 'Your posts stay inside the circles you choose. No public audience, no strangers, no algorithm pushing anything around.',
    });

    return nextSteps;
  }, [customCircleCount]);

  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <Modal isOpen={isOpen} onClose={handleDismiss} title="A tiny tour ✨">
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}> 
          <Text style={styles.emoji}>{currentStep.emoji}</Text>
          <Text style={[styles.title, { color: theme.foreground }]}>{currentStep.title}</Text>
          <Text style={[styles.body, { color: theme.mutedForeground }]}>{currentStep.body}</Text>
        </View>

        <View style={styles.dots}>
          {steps.map((step, index) => {
            const active = index === stepIndex;
            return (
              <Pressable
                key={`${step.title}-${index}`}
                onPress={() => setStepIndex(index)}
                style={[
                  styles.dot,
                  {
                    backgroundColor: active ? theme.primary : theme.muted,
                    width: active ? 24 : 8,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.actions}>
          {!isLastStep ? (
            <>
              <Button variant="tertiary" onPress={handleDismiss} style={styles.actionButton}>
                Skip
              </Button>
              <Button onPress={() => setStepIndex((prev) => { return prev + 1; })} style={styles.actionButton}>
                Next
              </Button>
            </>
          ) : (
            <Button onPress={handleDismiss} style={styles.doneButton}>
              Got it
            </Button>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
  },
  card: {
    minHeight: 260,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  doneButton: {
    width: '100%',
  },
});