import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Input } from './Input';
import { Label } from './Label';
import { Separator } from './Separator';
import { useTheme } from '@/hooks/useTheme';

export type AuthFormOnEmailSubmit = (params: {
  data: { email: string; password: string };
  action: 'login' | 'signup';
}) => Promise<{ error?: { message: string } }>;

interface AuthFormProps {
  methods: ('email' | 'google')[];
  action: 'both';
  onActionChange: (newMode: 'login' | 'sign up') => void;
  onEmailSubmit: AuthFormOnEmailSubmit;
  onGoogleSignIn?: () => Promise<{ error?: { message: string } }>;
}

export function AuthForm({ methods, action, onActionChange, onEmailSubmit, onGoogleSignIn }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { theme } = useTheme();

  const handleToggle = () => {
    const newMode = mode === 'login' ? 'signup' : 'login';
    setMode(newMode);
    setError('');
    onActionChange(newMode === 'login' ? 'login' : 'sign up');
  };

  const handleSubmit = async () => {
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    const result = await onEmailSubmit({ data: { email, password }, action: mode });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!onGoogleSignIn) return;
    setError('');
    setIsGoogleLoading(true);
    const result = await onGoogleSignIn();
    setIsGoogleLoading(false);
    if (result.error) {
      setError(result.error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.foreground }]}>
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </Text>

      {methods.includes('google') && onGoogleSignIn && (
        <Button
          variant="outline"
          onPress={handleGoogleSignIn}
          loading={isGoogleLoading}
          disabled={isGoogleLoading || isSubmitting}
        >
          Continue with Google
        </Button>
      )}

      {methods.includes('google') && methods.includes('email') && (
        <View style={styles.dividerRow}>
          <Separator style={styles.dividerLine} />
          <Text style={[styles.dividerText, { color: theme.mutedForeground }]}>or</Text>
          <Separator style={styles.dividerLine} />
        </View>
      )}

      {methods.includes('email') && (
        <View style={styles.form}>
          <View>
            <Label>Email</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View>
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {mode === 'signup' && (
            <View>
              <Label>Confirm Password</Label>
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </View>
          )}

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <Button
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || isGoogleLoading}
          >
            {mode === 'login' ? 'Sign In' : 'Sign Up'}
          </Button>
        </View>
      )}

      <View style={styles.toggleRow}>
        <Text style={{ color: theme.mutedForeground }}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
        </Text>
        <Button variant="link" onPress={handleToggle}>
          {mode === 'login' ? 'Sign Up' : 'Sign In'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
