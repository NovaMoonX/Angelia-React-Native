import React, { createContext, useCallback, useRef, useState } from 'react';
import {
  Animated,
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

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const colors = TOAST_COLORS[item.type];

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss(item.id));
    }, 4000);

    return () => clearTimeout(timer);
  }, [item.id, onDismiss, opacity, translateY]);

  const handleBodyPress = item.onPress
    ? () => {
        item.onPress!();
        onDismiss(item.id);
      }
    : undefined;

  return (
    <Pressable onPress={handleBodyPress} disabled={!item.onPress}>
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.bg, borderLeftColor: colors.border, opacity, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.toastContent}>
          <Text style={styles.toastIcon}>{TOAST_ICONS[item.type]}</Text>
          <View style={styles.toastTextContainer}>
            <Text style={[styles.toastTitle, { color: colors.text }]}>{item.title}</Text>
            {item.description && (
              <Text style={[styles.toastDescription, { color: colors.text }]}>{item.description}</Text>
            )}
          </View>
          <Pressable onPress={() => onDismiss(item.id)} hitSlop={8}>
            <Text style={[styles.toastClose, { color: colors.text }]}>✕</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
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
  toastIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  toastTextContainer: {
    flex: 1,
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
