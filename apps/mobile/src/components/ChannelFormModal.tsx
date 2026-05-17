import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Form, FormFactories, type FormCustomFieldProps } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { CHANNEL_COLORS } from '@/models/constants';
import type { Channel } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';

interface ChannelFormData {
  name: string;
  description: string;
  color: string;
}

interface ChannelFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChannelFormData & { isPrivate: boolean }) => void;
  channel?: Channel;
  mode: 'create' | 'edit';
  existingChannelNames?: string[];
}

function ColorPickerField({
  value,
  onValueChange,
}: FormCustomFieldProps<unknown>) {
  const selectedColor = value as string;

  return (
    <View style={colorStyles.grid}>
      {CHANNEL_COLORS.map((color) => (
        <Pressable
          key={color.name}
          onPress={() => onValueChange(color.name)}
          style={[
            colorStyles.swatch,
            { backgroundColor: color.value },
            selectedColor === color.name && colorStyles.selected,
          ]}
        >
          {selectedColor === color.name && (
            <Text style={{ color: color.textColor, fontSize: 16 }}>✓</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const colorStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
});

export function ChannelFormModal({
  isOpen,
  onClose,
  onSubmit,
  channel,
  mode,
  existingChannelNames = [],
}: ChannelFormModalProps) {
  const { theme } = useTheme();
  const [isPrivate, setIsPrivate] = useState<boolean>(channel?.isPrivate ?? false);

  // Reset isPrivate when modal opens for a different channel or create mode
  React.useEffect(() => {
    setIsPrivate(channel?.isPrivate ?? false);
  }, [channel?.id, isOpen]);

  const formFields = useMemo(
    () => [
      FormFactories.input({
        name: 'name',
        label: 'Circle Name',
        placeholder: 'e.g., Family Adventures',
        required: true,
        isValid: (value) => {
          const name = ((value as string) || '').trim();
          if (!name) return { valid: false, title: 'Circle name is required' };
          if (
            existingChannelNames
              .filter((n) => n !== channel?.name)
              .includes(name)
          ) {
            return { valid: false, title: 'Circle name already exists' };
          }
          return { valid: true };
        },
      }),
      FormFactories.textarea({
        name: 'description',
        label: 'Description',
        placeholder: 'Share what this circle is about...',
        rows: 3,
      }),
      FormFactories.custom({
        name: 'color',
        label: 'Circle Color',
        required: true,
        renderComponent: ColorPickerField,
        isValid: (value) => {
          if (!value) return { valid: false, title: 'Please select a color' };
          return { valid: true };
        },
      }),
    ],
    [existingChannelNames, channel?.name]
  );

  const initialData: ChannelFormData = {
    name: channel?.name || '',
    description: channel?.description || '',
    color: channel?.color || 'INDIGO',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create New Circle' : 'Edit Circle'}
    >
      <Form<ChannelFormData>
        form={formFields}
        initialData={initialData}
        onSubmit={(data) => onSubmit({ ...data, isPrivate })}
        submitButton={(handleSubmit) => (
          <>
            {/* Private circle toggle */}
            <Pressable
              onPress={() => setIsPrivate((prev) => !prev)}
              style={[formModalStyles.toggleRow, { borderColor: theme.border }]}
            >
              <View style={formModalStyles.toggleLabel}>
                <Text style={[formModalStyles.toggleTitle, { color: theme.foreground }]}>
                  🔒 Private Circle
                </Text>
                <Text style={[formModalStyles.toggleDescription, { color: theme.mutedForeground }]}>
                  {isPrivate
                    ? 'Only you can invite people. Not suggested to others.'
                    : 'Anyone with the invite link can request to join.'}
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </Pressable>

            <View style={formModalStyles.buttonRow}>
              <Button variant="tertiary" onPress={onClose}>
                Cancel
              </Button>
              <Button onPress={handleSubmit}>
                {mode === 'create' ? 'Create Circle' : 'Save Changes'}
              </Button>
            </View>
          </>
        )}
      />
    </Modal>
  );
}

const formModalStyles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
});
