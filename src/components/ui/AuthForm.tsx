import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from './Button';
import { Input } from './Input';
import { Label } from './Label';
import { useTheme } from '@/hooks/useTheme';

const PASSWORD_CRITERIA = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One symbol (e.g. !@#$%)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function PasswordCriteriaChecklist({ password }: { password: string }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const cellWidth = width < 360 ? '100%' : '50%';

  return (
    <View style={criteriaStyles.grid}>
      {PASSWORD_CRITERIA.map((c) => {
        const met = c.test(password);
        return (
          <View key={c.label} style={[criteriaStyles.cell, { width: cellWidth }]}>
            <Text style={[criteriaStyles.indicator, { color: met ? '#16A34A' : theme.mutedForeground }]}>
              {met ? '✓' : '○'}
            </Text>
            <Text style={[criteriaStyles.label, { color: met ? '#16A34A' : theme.mutedForeground }]}>
              {c.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const criteriaStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 6,
    rowGap: 6,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  indicator: {
    fontSize: 12,
    fontWeight: '700',
    width: 14,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
  },
});

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
  defaultMethod?: 'email';
  onBack?: () => void;
}

export function AuthForm({ methods, action, onActionChange, onEmailSubmit, onGoogleSignIn, defaultMethod, onBack }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [selectedMethod, setSelectedMethod] = useState<'email' | null>(defaultMethod ?? null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { theme } = useTheme();

  const handleToggle = () => {
    const newMode = mode === 'login' ? 'signup' : 'login';
    setMode(newMode);
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
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

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError('Password must include at least one uppercase letter.');
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError('Password must include at least one number.');
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setError('Password must include at least one symbol (e.g. !@#$%).');
        return;
      }
    } else if (password.length < 6) {
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

  const handleBackToMethods = () => {
    if (defaultMethod && onBack) {
      onBack();
    } else {
      setSelectedMethod(null);
      setError('');
    }
  };

  // ---- Method picker (initial view) ----
  if (!selectedMethod) {
    return (
      <View style={styles.container}>
        <Text style={[styles.heading, { color: theme.foreground }]}>
          Get Started
        </Text>

        {methods.includes('google') && onGoogleSignIn && (
          <Button
            variant="outline"
            onPress={handleGoogleSignIn}
            loading={isGoogleLoading}
            disabled={isGoogleLoading}
          >
            Continue with Google
          </Button>
        )}

        {methods.includes('email') && (
          <Button
            variant="outline"
            onPress={() => setSelectedMethod('email')}
            disabled={isGoogleLoading}
          >
            Continue with Email
          </Button>
        )}

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}
      </View>
    );
  }

  // ---- Email form (after selecting "Continue with Email") ----
  return (
    <View style={styles.container}>
      <Pressable onPress={handleBackToMethods} style={styles.backRow}>
        <Feather name="arrow-left" size={18} color={theme.primary} />
        <Text style={[styles.backText, { color: theme.primary }]}>
          All sign-in options
        </Text>
      </Pressable>

      <Text style={[styles.heading, { color: theme.foreground }]}>
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </Text>

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
          <View style={styles.passwordContainer}>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoComplete="password"
              style={styles.passwordInput}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
              hitSlop={8}
            >
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color={theme.mutedForeground}
              />
            </Pressable>
          </View>
          {mode === 'signup' && password.length > 0 && (
            <PasswordCriteriaChecklist password={password} />
          )}
        </View>

        {mode === 'signup' && (
          <View>
            <Label>Confirm Password</Label>
            <View style={styles.passwordContainer}>
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                style={styles.passwordInput}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Feather
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={theme.mutedForeground}
                />
              </Pressable>
            </View>
          </View>
        )}

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <Button
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </Button>
      </View>

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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
