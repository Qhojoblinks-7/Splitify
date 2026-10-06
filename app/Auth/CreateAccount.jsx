import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Mail, Lock, Phone } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BaseButton from '../../components/atoms/BaseButton';
import CustomInput from '../../components/atoms/CustomInput';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';
import { useSessionStore } from '../../store/session';
import colors from "../../theme/colors";

export default function CreateAccount() {
    const router = useRouter();
    const register = useSessionStore((s) => s.register);
    const status = useSessionStore((s) => s.status);
    const authError = useSessionStore((s) => s.authError);
    const clearAuthError = useSessionStore((s) => s.clearAuthError);

    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agree, setAgree] = useState(false);

    const busy = status === 'signingIn';
    const passwordsMatch = password === confirmPassword && password.length > 0;
    const canSubmit = phone.trim().length > 0 && password.length >= 12 && passwordsMatch && agree && !busy;

    const onPressSignUp = async () => {
        if (!canSubmit) return;
        clearAuthError();
        const result = await register({
            phone: phone.trim(),
            email: email.trim() || undefined,
            password,
        });
        if (result.ok) {
            setPassword('');
            setConfirmPassword('');
            router.replace('/(tabs)');
        }
    };

    return (
        <AuthScreenLayout
          title="Create Account"
          footer={
            <>
              <View style={styles.dividerLine} />
              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>Already have an account? </Text>
                <Pressable
                  onPress={() => router.replace('/Auth/Login')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1.0 }]}
                >
                  <Text style={styles.signInLink}>Sign In</Text>
                </Pressable>
              </View>
              <BaseButton
                title={busy ? 'Creating account...' : 'Sign Up'}
                variant='primary'
                fullWidth
                disabled={!canSubmit}
                isLoading={busy}
                onPress={onPressSignUp}
              />
            </>
          }
        >
            <CustomInput
                label="Phone number"
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
                label="Email"
                keyboardType="email-address"
                autoCapitalize='none'
                placeholder='you@example.com'
                placeholderTextColor={colors.inactive}
                borderColor={colors.inactive}
                iconLeft={<Mail size={20} color={colors.inactive} />}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
            />

            <CustomInput
                label="Password"
                secureTextEntry
                placeholder='At least 12 characters'
                placeholderTextColor={colors.inactive}
                borderColor={colors.inactive}
                iconLeft={<Lock color={colors.inactive} size={20} />}
                style={styles.input}
                value={password}
                onChangeText={(text) => {
                    clearAuthError();
                    setPassword(text);
                }}
            />

            <CustomInput
                label="Confirm Password"
                secureTextEntry
                placeholder='Type your password again'
                placeholderTextColor={colors.inactive}
                borderColor={colors.inactive}
                iconLeft={<Lock color={colors.inactive} size={20} />}
                style={styles.input}
                value={confirmPassword}
                onChangeText={(text) => {
                    clearAuthError();
                    setConfirmPassword(text);
                }}
            />

            {authError ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{authError}</Text>
                </View>
            ) : null}

            <View style={styles.checkboxContainer}>
                <Pressable
                    onPress={() => setAgree(!agree)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1.0 }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agree }}
                >
                    <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                        {agree && <View style={styles.checkmark} />}
                    </View>
                    <Pressable onPress={() => router.push('/PrivacyPolicy')}>
                        <Text style={styles.checkboxLabel}>
                            I have read the Privacy Notice, and I agree that Ntuboa may process my data
                            to run my susu group.
                        </Text>
                    </Pressable>
                </Pressable>
            </View>
        </AuthScreenLayout>
    );
}

const styles = StyleSheet.create({
    input: {
        width: '100%',
        marginBottom: 16,
    },
    dividerLine: {
        width: '100%',
        height: 1,
        backgroundColor: colors.borderSubtle,
        marginBottom: 20,
    },
    signInContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    signInText: {
        color: colors.placeholder,
        fontSize: 15,
        textAlign: "center"
    },
    signInLink: {
        color: colors.gold,
        fontWeight: '600',
        fontSize: 15,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        marginBottom: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 8,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.gold,
        borderColor: colors.gold,
    },
    checkmark: {
        width: 12,
        height: 6,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderColor: colors.background,
        transform: [{ rotate: '-45deg' }],
        marginTop: 4,
    },
    checkboxLabel: {
        marginLeft: 4,
        color: colors.placeholder,
        fontSize: 14,
        flex: 1,
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
});