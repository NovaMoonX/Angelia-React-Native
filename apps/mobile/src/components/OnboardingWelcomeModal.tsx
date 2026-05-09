import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/hooks/useTheme';
import { CUSTOM_POST_RETENTION_DAYS, DAILY_POST_RETENTION_DAYS } from '@/models/constants';

interface OnboardingWelcomeModalProps {
  isOpen: boolean;
  customCircleCount: number;
  onDismiss: () => void;
}

interface GuideStep {
  emoji: string;
  title: string;
  body: string;
}

export function OnboardingWelcomeModal({ isOpen, customCircleCount, onDismiss }: OnboardingWelcomeModalProps) {
  const { theme } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);

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
    if (!isOpen) return;
    setStepIndex(0);
  }, [isOpen]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <Modal isOpen={isOpen} onClose={onDismiss} title="A tiny tour ✨">
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
              <Button variant="tertiary" onPress={onDismiss} style={styles.actionButton}>
                Skip
              </Button>
              <Button onPress={() => setStepIndex((prev) => { return prev + 1; })} style={styles.actionButton}>
                Next
              </Button>
            </>
          ) : (
            <Button onPress={onDismiss} style={styles.doneButton}>
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