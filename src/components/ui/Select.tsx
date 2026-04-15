import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface SelectOption {
  text: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Select({ options, value, onChange, placeholder }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const selectedOption = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={[styles.trigger, { borderColor: theme.border, backgroundColor: theme.background }]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedOption ? theme.foreground : theme.mutedForeground },
          ]}
          numberOfLines={1}
        >
          {selectedOption?.text || placeholder || 'Select...'}
        </Text>
        <Feather name="chevron-down" size={16} color={theme.mutedForeground} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View
            style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}
            onStartShouldSetResponder={() => true}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  style={[
                    styles.option,
                    item.value === value && { backgroundColor: theme.secondary },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: theme.foreground },
                      item.value === value && { fontWeight: '600' },
                    ]}
                  >
                    {item.text}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: 32,
  },
  dropdown: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 14,
  },
});
