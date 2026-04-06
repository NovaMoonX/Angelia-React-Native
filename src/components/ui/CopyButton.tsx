import React, { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Button } from './Button';
import type { ViewStyle, TextStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'outline' | 'link' | 'destructive';

interface CopyButtonProps {
  textToCopy: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children: React.ReactNode;
}

export function CopyButton({
  textToCopy,
  variant = 'secondary',
  size,
  disabled = false,
  onPress,
  style,
  textStyle,
  children,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handlePress = async () => {
    await Clipboard.setStringAsync(textToCopy);
    setCopied(true);
    onPress?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || copied}
      onPress={handlePress}
      style={style}
      textStyle={textStyle}
    >
      {copied ? 'Copied!' : children}
    </Button>
  );
}
