import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Checkbox from 'expo-checkbox';
import { Phone, Lock } from 'lucide-react-native';
import BaseButton from '../../components/atoms/BaseButton';
import CustomInput from '../../components/atoms/CustomInput';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';
import { useSessionStore } from '../../store/session';
import colors from "../../theme/colors";

/**
 * Sign in against the server.
 *
 * This screen used to navigate to the tabs without asking anyone anything, which meant every
 * screen behind it rendered a hardcoded user against a hardcoded group list. The button now
 * does the only thing that should happen here: ask the server whether these credentials are
 * good, and stay put if they are not. P2, I23.
 */
export default function Login() {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const authenticate = useSessionStore((s) => s.authenticate);
  const status = useSessionStore((s) => s.status);
  const authError = useSessionStore((s) => s.authError);
  const clearAuthError = useSessionStore((s) => s.clearAuthError);
  const busy = status === 'signingIn';

  const canSubmit = phone.trim().length > 0 && password.length > 0 && !busy;

  const onPressLogin = async () => {
    if (!canSubmit) return;

    const result = await authenticate({ phone: phone.trim(), password });
    if (result.ok) {
      setPassword('');
      router.replace('/(tabs)');
    }
    // On failure the store holds the message; the screen shows it and stays put.
  };

  const onPressForgotPassword = () => {
    router.push('/Auth/ForgotPassword');
  };

  return (
    <AuthScreenLayout
      title="Welcome Back!"
      footer={
        <BaseButton
          title={busy ? 'Signing in...' : 'Login'}
          onPress={onPressLogin}
          fullWidth
          variant='primary'
          disabled={!canSubmit}
        />
      }
    >
      <CustomInput
        label='Phone number'
        keyboardType='phone-pad'
        autoCapitalize='none'
        placeholder='+233 20 000 0000'
        placeholderTextColor={colors.inactive}
        borderColor={colors.inactive}
        iconLeft={<Phone color={colors.inactive} size={20} />}
        style={styles.input}
        value={phone}
        onChangeText={(text) => {
          clearAuthError();
          setPhone(text);
        }}
      />

      <CustomInput
        label='Password'
        secureTextEntry
        placeholderTextColor={colors.inactive}
        iconLeft={<Lock color={colors.inactive} size={20} />}
        style={styles.input}
        borderColor={colors.inactive}
        value={password}
        onChangeText={(text) => {
          clearAuthError();
          setPassword(text);
        }}
        onSubmitEditing={onPressLogin}
      />

      {authError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{authError}</Text>
        </View>
      ) : null}

      {busy ? <ActivityIndicator color={colors.gold} style={styles.spinner} /> : null}

      <View style={styles.RememberMeContainer}>
        <View style={styles.checkboxContainer}>
          <Checkbox
            value={rememberMe}
            onValueChange={setRememberMe}
            color={rememberMe ? colors.gold : undefined}
            style={styles.checkboxBorderFix}
          />
          <Text style={styles.checkboxLabel}>Remember Me</Text>
        </View>

        <Pressable onPress={onPressForgotPassword}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </Pressable>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
    input: {
        width: '100%',
        marginBottom: 15,
    },
    errorBox: {
        width: '100%',
        backgroundColor: colors.dangerSoftAlt,
        borderRadius: 10,
        borderLeftWidth: 3,
        borderLeftColor: colors.danger,
        padding: 12,
        marginBottom: 12,
    },
    errorText: {
        color: colors.danger,
        fontSize: 13,
        lineHeight: 18,
    },
    spinner: {
        marginBottom: 12,
    },
    RememberMeContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingTop: 30,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkboxBorderFix: {
        borderColor: colors.gold,
        borderWidth: 0.5,
    },
    checkboxLabel: {
        marginLeft: 8,
        color: colors.placeholder,
    },
    forgotPassword: {
        color: colors.textBodyAlt,
    }
});