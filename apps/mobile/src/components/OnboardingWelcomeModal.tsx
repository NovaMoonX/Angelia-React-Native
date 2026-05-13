import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAppSelector } from '@/store/hooks';
import { selectCurrentUserCustomChannels } from '@/store/crossSelectors/channelSelectors';
import { useTheme } from '@/hooks/useTheme';
import { CUSTOM_CHANNEL_LIMIT, CUSTOM_POST_RETENTION_DAYS, DAILY_POST_RETENTION_DAYS } from '@/models/constants';

interface GuideStep {
  emoji: string;
  title: string;
  body: string | React.ReactNode;
}

interface OnboardingWelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OnboardingWelcomeModal({ visible, onClose }: OnboardingWelcomeModalProps) {
  const { theme } = useTheme();
  const customChannels = useAppSelector(selectCurrentUserCustomChannels);
  const customCircleCount = customChannels.length;

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
        body: `Create up to ${CUSTOM_CHANNEL_LIMIT} — one for a hobby, a close friend group, a project, or any slice of life that deserves its own lane. Posts there last ${CUSTOM_POST_RETENTION_DAYS} days.`,
      });
    }

    // Status step: varies based on how many custom circles the user has created
    if (customCircleCount === 0) {
      nextSteps.push({
        emoji: '✨',
        title: 'You can create up to 3 Custom Circles',
        body: `Think hobbies, a friend group, travel, side projects — anything that deserves its own space. Head to the Circles tab when you're ready to set one up.`,
      });
    } else if (customCircleCount < CUSTOM_CHANNEL_LIMIT) {
      const remaining = CUSTOM_CHANNEL_LIMIT - customCircleCount;
      nextSteps.push({
        emoji: '🙌',
        title: `Nice — you already set up ${customCircleCount} Custom ${customCircleCount === 1 ? 'Circle' : 'Circles'}!`,
        body: `You still have ${remaining} spot${remaining === 1 ? '' : 's'} left. Use ${remaining === 1 ? 'it' : 'them'} for another hobby, a close group, or any slice of life that deserves its own lane.`,
      });
    } else {
      nextSteps.push({
        emoji: '🎉',
        title: "You've filled all your Custom Circles — love that!",
        body: 'Now the best move is inviting your people in. Head to the My People tab and share your invite links so the circles actually come alive.',
      });
    }

    nextSteps.push({
      emoji: '⏳',
      title: 'Posts have a natural lifespan — on purpose',
      body: (<>
        <Text style={{ fontWeight: '700' }}>{DAILY_POST_RETENTION_DAYS} days</Text>{' '}for Daily Circle posts to keep things lightweight.{' '}
        Custom Circle posts last{' '}<Text style={{ fontWeight: '700' }}>{CUSTOM_POST_RETENTION_DAYS} days</Text>{' '}because those spaces are more intentional — you put thought into them, so the memories stick around a little longer.
      </>),
    });

    nextSteps.push({
      emoji: '🔒',
      title: 'You are still in control of the room',
      body: 'Your posts stay inside the circles you choose. No public audience, no strangers, no algorithm pushing anything around.',
    });

    return nextSteps;
  }, [customCircleCount]);

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <Modal isOpen={visible} onClose={onClose} title="A tiny tour ✨">
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
              <Button variant="tertiary" onPress={onClose} style={styles.actionButton}>
                Skip
              </Button>
              <Button onPress={() => setStepIndex((prev) => { return prev + 1; })} style={styles.actionButton}>
                Next
              </Button>
            </>
          ) : (
            <Button onPress={onClose} style={styles.doneButton}>
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