import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Label } from './Label';
import { useTheme } from '@/hooks/useTheme';

export interface FormCustomFieldProps<T> {
  value: T;
  onValueChange: (value: T) => void;
}

interface FormFieldBase {
  name: string;
  label: string;
  required?: boolean;
  isValid?: (value: unknown) => { valid: boolean; message?: string };
}

interface InputField extends FormFieldBase {
  type: 'input';
  placeholder?: string;
}

interface TextareaField extends FormFieldBase {
  type: 'textarea';
  placeholder?: string;
  rows?: number;
}

interface CustomField extends FormFieldBase {
  type: 'custom';
  renderComponent: (props: FormCustomFieldProps<unknown>) => React.ReactNode;
}

type FormField = InputField | TextareaField | CustomField;

export const FormFactories = {
  input(config: Omit<InputField, 'type'>): FormField {
    return { ...config, type: 'input' };
  },
  textarea(config: Omit<TextareaField, 'type'>): FormField {
    return { ...config, type: 'textarea' };
  },
  custom(config: Omit<CustomField, 'type'>): FormField {
    return { ...config, type: 'custom' };
  },
};

interface FormProps<T extends Record<string, any>> {
  form: FormField[];
  initialData: T;
  onSubmit: (data: T) => void;
  onDataChange?: (data: T) => void;
  submitButton?: React.ReactNode;
}

export function Form<T extends Record<string, any>>({
  form,
  initialData,
  onSubmit,
  onDataChange,
  submitButton,
}: FormProps<T>) {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { theme } = useTheme();

  const updateField = (name: string, value: unknown) => {
    const newData = { ...data, [name]: value } as T;
    setData(newData);
    onDataChange?.(newData);

    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    for (const field of form) {
      if (field.required && !data[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.isValid) {
        const result = field.isValid(data[field.name]);
        if (!result.valid && result.message) {
          newErrors[field.name] = result.message;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(data);
  };

  return (
    <View style={styles.container}>
      {form.map((field) => (
        <View key={field.name} style={styles.field}>
          <Label>
            {field.label}
            {field.required ? ' *' : ''}
          </Label>

          {field.type === 'input' && (
            <Input
              value={(data[field.name] as string) || ''}
              onChangeText={(text) => updateField(field.name, text)}
              placeholder={field.placeholder}
            />
          )}

          {field.type === 'textarea' && (
            <Textarea
              value={(data[field.name] as string) || ''}
              onChangeText={(text) => updateField(field.name, text)}
              placeholder={field.placeholder}
              rows={field.rows}
            />
          )}

          {field.type === 'custom' &&
            field.renderComponent({
              value: data[field.name],
              onValueChange: (val) => updateField(field.name, val),
            })}

          {errors[field.name] && (
            <Text style={styles.error}>{errors[field.name]}</Text>
          )}
        </View>
      ))}

      {submitButton ? (
        <View onTouchEnd={handleSubmit}>{submitButton}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  field: {
    gap: 4,
  },
  error: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
});
