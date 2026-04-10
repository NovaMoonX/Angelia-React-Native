import React, { createContext, useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface AlertOptions {
  title?: string;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ActionModalContextType {
  alert: (options: AlertOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ActionModalContext = createContext<ActionModalContextType>({
  alert: () => {},
  confirm: () => Promise.resolve(false),
});

type ModalState =
  | { type: 'alert'; options: AlertOptions }
  | { type: 'confirm'; options: ConfirmOptions };

export function ActionModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const alert = useCallback((options: AlertOptions) => {
    setModalState({ type: 'alert', options });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setModalState({ type: 'confirm', options });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setModalState(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
    setModalState(null);
  }, []);

  const isAlert = modalState?.type === 'alert';
  const title = modalState?.options
    ? 'title' in modalState.options
      ? modalState.options.title
      : undefined
    : undefined;
  const message = modalState?.options?.message ?? '';
  const isDestructive =
    modalState?.type === 'confirm' ? modalState.options.destructive : false;
  const confirmText =
    modalState?.type === 'confirm' ? modalState.options.confirmText || 'Confirm' : 'OK';
  const cancelText =
    modalState?.type === 'confirm' ? modalState.options.cancelText || 'Cancel' : '';

  return (
    <ActionModalContext.Provider value={{ alert, confirm }}>
      {children}
      <Modal
        visible={modalState !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={styles.message}>{message}</Text>
            <View style={styles.buttonRow}>
              {!isAlert && (
                <Pressable style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </Pressable>
              )}
              <Pressable
                style={[
                  styles.confirmButton,
                  isDestructive && styles.destructiveButton,
                ]}
                onPress={isAlert ? handleClose : handleConfirm}
              >
                <Text
                  style={[
                    styles.confirmText,
                    isDestructive && styles.destructiveText,
                  ]}
                >
                  {isAlert ? 'OK' : confirmText}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </ActionModalContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  destructiveButton: {
    backgroundColor: '#DC2626',
  },
  destructiveText: {
    color: '#FFFFFF',
  },
});
