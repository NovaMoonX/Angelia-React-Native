import React, { createContext, useCallback, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface ToastOptions {
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  /** Optional callback invoked when the user taps the toast body. The toast is auto-dismissed on tap. */
  onPress?: () => void;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextType {
  addToast: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
});

const TOAST_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: '#F0FFF4', border: '#16A34A', text: '#166534' },
  error: { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B' },
  warning: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
  info: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
};

const TOAST_ICONS: Record<string, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const SWIPE_OUT_DISTANCE = 500;
const AUTO_DISMISS_DEFAULT_MS = 4000;
const AUTO_DISMISS_INTERACTIVE_MS = 8000;
const MOVE_ACTIVATION_THRESHOLD = 12;
const SWIPE_TRIGGER_THRESHOLD = 16;
const DISMISS_SWIPE_DURATION_MS = 150;

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const colors = TOAST_COLORS[item.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);
  const didFinalizeDismissRef = useRef(false);
  const didMovePastActivationRef = useRef(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const getAutoDismissDelay = useCallback(() => {
    return item.onPress ? AUTO_DISMISS_INTERACTIVE_MS : AUTO_DISMISS_DEFAULT_MS;
  }, [item.onPress]);

  const clearAutoDismissTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearDismissFallback = useCallback(() => {
    if (dismissFallbackRef.current) {
      clearTimeout(dismissFallbackRef.current);
      dismissFallbackRef.current = null;
    }
  }, []);

  const finalizeDismiss = useCallback((direction: 'left' | 'right' | 'up' | 'down' | 'auto') => {
    if (didFinalizeDismissRef.current) {
      return;
    }
    didFinalizeDismissRef.current = true;
    clearDismissFallback();
    onDismiss(item.id);
  }, [clearDismissFallback, item.id, onDismiss]);

  const startAutoDismissTimer = useCallback(() => {
    clearAutoDismissTimer();
    const delay = getAutoDismissDelay();
    timerRef.current = setTimeout(() => {
      dismissRef.current();
    }, delay);
  }, [clearAutoDismissTimer, getAutoDismissDelay]);

  // Use a ref so PanResponder callbacks (created once) always call the latest dismiss.
  const dismissRef = useRef<(direction?: 'left' | 'right' | 'up' | 'down') => void>(() => {});

  const dismiss = useCallback(
    (direction?: 'left' | 'right' | 'up' | 'down') => {
      if (isDismissingRef.current) {
        return;
      }
      isDismissingRef.current = true;
      setIsDismissing(true);
      clearAutoDismissTimer();
      clearDismissFallback();
      dismissFallbackRef.current = setTimeout(() => {
        finalizeDismiss(direction ?? 'auto');
      }, 280);

      if (direction === 'left' || direction === 'right') {
        const toX = direction === 'left' ? -SWIPE_OUT_DISTANCE : SWIPE_OUT_DISTANCE;
        Animated.parallel([
          // Keep the swipe axis on the JS driver so PanResponder updates do not
          // fight the native animated event pipeline.
          Animated.timing(translateX, { toValue: toX, duration: DISMISS_SWIPE_DURATION_MS, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: DISMISS_SWIPE_DURATION_MS, useNativeDriver: false }),
        ]).start(() => {
          finalizeDismiss(direction);
        });
      } else if (direction === 'up') {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -SWIPE_OUT_DISTANCE, duration: DISMISS_SWIPE_DURATION_MS, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: DISMISS_SWIPE_DURATION_MS, useNativeDriver: false }),
        ]).start(() => {
          finalizeDismiss(direction);
        });
      } else if (direction === 'down') {
        Animated.parallel([
          Animated.timing(translateY, { toValue: SWIPE_OUT_DISTANCE, duration: DISMISS_SWIPE_DURATION_MS, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: DISMISS_SWIPE_DURATION_MS, useNativeDriver: false }),
        ]).start(() => {
          finalizeDismiss(direction);
        });
      } else {
        // Close/button body taps should feel instant; skip exit animation.
        finalizeDismiss('auto');
      }
    },
    [clearAutoDismissTimer, clearDismissFallback, finalizeDismiss, opacity, translateY, translateX],
  );

  // Keep the ref current so PanResponder always calls the latest version.
  React.useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  React.useEffect(() => {
    startAutoDismissTimer();

    return () => {
      clearAutoDismissTimer();
      clearDismissFallback();
    };
  }, [clearAutoDismissTimer, clearDismissFallback, startAutoDismissTimer]);

  const panResponder = useRef(
    PanResponder.create({
      // Never claim touch start so close/body taps are always handled immediately.
      // Swipes are captured once movement is intentional.
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Claim the gesture once meaningful movement is detected.
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > MOVE_ACTIVATION_THRESHOLD || Math.abs(gs.dy) > MOVE_ACTIVATION_THRESHOLD,
      // Do not capture in the capture phase; let nested Pressables (especially close) win taps.
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        if (isDismissingRef.current) {
          return;
        }
        didMovePastActivationRef.current = false;
      },
      onPanResponderMove: (_, gs) => {
        if (isDismissingRef.current) {
          return;
        }
        if (!didMovePastActivationRef.current && (Math.abs(gs.dx) > MOVE_ACTIVATION_THRESHOLD || Math.abs(gs.dy) > MOVE_ACTIVATION_THRESHOLD)) {
          didMovePastActivationRef.current = true;
          // Pause auto-dismiss only once we're sure this is an intentional drag.
          clearAutoDismissTimer();
        }
        translateX.setValue(gs.dx);
        // Track both up and down swipe movement for easier dismiss gestures.
        translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (isDismissingRef.current) {
          return;
        }
        if (gs.dx < -SWIPE_TRIGGER_THRESHOLD) {
          dismissRef.current('left');
        } else if (gs.dx > SWIPE_TRIGGER_THRESHOLD) {
          dismissRef.current('right');
        } else if (gs.dy < -SWIPE_TRIGGER_THRESHOLD) {
          dismissRef.current('up');
        } else if (gs.dy > SWIPE_TRIGGER_THRESHOLD) {
          dismissRef.current('down');
        } else {
          // Incomplete swipe — spring back to resting position.
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: false }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
          ]).start();
          // Restart timer only if this interaction actually paused it.
          if (didMovePastActivationRef.current) {
            startAutoDismissTimer();
          }
        }
      },
      onPanResponderTerminate: (_, gs) => {
        if (isDismissingRef.current) {
          return;
        }
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: false }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
        ]).start();
        if (didMovePastActivationRef.current) {
          startAutoDismissTimer();
        }
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const handleBodyPress = item.onPress
    ? () => {
      if (isDismissingRef.current) {
        return;
      }
      item.onPress!();
      dismissRef.current();
    }
    : undefined;

  return (
    <Animated.View
      pointerEvents={isDismissing ? 'none' : 'auto'}
      style={[
        styles.toast,
        {
          backgroundColor: colors.bg,
          borderLeftColor: colors.border,
          opacity,
          transform: [{ translateY }, { translateX }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.toastContent}>
        <Pressable
          style={styles.toastMainPressable}
          onPress={handleBodyPress}
          onPressIn={() => {
            if (isDismissingRef.current) {
              return;
            }
          }}
          disabled={!item.onPress}
        >
          <Text style={styles.toastIcon}>{TOAST_ICONS[item.type]}</Text>
          <View style={styles.toastTextContainer}>
            <Text style={[styles.toastTitle, { color: colors.text }]}>{item.title}</Text>
            {item.description && (
              <Text style={[styles.toastDescription, { color: colors.text }]}>{item.description}</Text>
            )}
          </View>
        </Pressable>
        <Pressable
          style={styles.toastClosePressable}
          onPressIn={() => {
            if (isDismissingRef.current) {
              return;
            }
          }}
          onPress={() => {
            if (isDismissingRef.current) {
              return;
            }
            dismissRef.current();
          }}
          hitSlop={12}
        >
          <Text style={[styles.toastClose, { color: colors.text }]}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((options: ToastOptions) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((item) => (
          <Toast key={item.id} item={item} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  toastMainPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastClosePressable: {
    marginLeft: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toastDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  toastClose: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
});
