import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useSessionStore } from '../../store/session';
import { Alert, toast } from '../../utils/alert';
import GoogleIcon from '../../assets/images/google.svg';
import BaseButton from '../../components/atoms/BaseButton';
import colors from '../../theme/colors';

WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });

const LOGO_HEIGHT = 52;
const MAX_LOGO_WIDTH = 180;

const GOOGLE_CLIENT_ID =
  Constants?.expoConfig?.extra?.googleClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  '';

export default function Auth() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const logoWidth = Math.min(width * 0.46, MAX_LOGO_WIDTH);
  const logoHeight = logoWidth * (LOGO_HEIGHT / MAX_LOGO_WIDTH);
  const compact = height < 700;

  const [socialBusy, setSocialBusy] = useState(null);
  const socialError = useSessionStore((s) => s.authError);
  const clearAuthError = useSessionStore((s) => s.clearAuthError);
  const socialSignIn = useSessionStore((s) => s.socialSignIn);

  const onSocialResult = (result) => {
    if (result?.ok && result.requires_profile_completion) {
      router.replace('/CompleteProfile');
    } else {
      router.replace('/(tabs)');
    }
  };

  const onPressGoogle = async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.info('Google client ID is not configured.');
      return;
    }
    setSocialBusy('google');
    clearAuthError();

    try {
      const randomBytes = Crypto.getRandomBytes(16);
      const nonce = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const redirectUri = AuthSession.makeRedirectUri({
        path: 'auth/google/callback',
      });

      const authUrl =
        'https://accounts.google.com/oauth/authorize?' +
        new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'id_token',
          scope: 'openid email profile',
          nonce,
        }).toString();

      const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (authResult?.type !== 'success') {
        setSocialBusy(null);
        return;
      }

      const url = new URL(authResult.url);
      const idToken = url.hash.replace(/^#/, '').match(/id_token=([^&]+)/)?.[1];

      if (!idToken) {
        setSocialBusy(null);
        return;
      }

      const signInResult = await socialSignIn({ provider: 'google', idToken });
      onSocialResult(signInResult);
    } catch (e) {
      // error is set in the session store by the auth service
    } finally {
      setSocialBusy(null);
    }
  };

  const onPressApple = async () => {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      toast.info('Apple Sign-In is only available on iOS and macOS. On Android, use Google or phone number.');
      return;
    }

    setSocialBusy('apple');
    clearAuthError();

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setSocialBusy(null);
        return;
      }

      // Apple returns email only on first sign-in. If present, we can use it
      // for account linking; otherwise the backend uses the Apple sub.
      const result = await socialSignIn({
        provider: 'apple',
        idToken: credential.identityToken,
      });
      onSocialResult(result);
    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled — not an error, just stop busy state.
      }
      // Other errors are set in the session store by the auth service
    } finally {
      setSocialBusy(null);
    }
  };

  const onPressSignUp = () => {
    router.push('/Auth/CreateAccount');
  };

  const onPressLogin = () => {
    router.push('/Auth/Login');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        compact && styles.contentCompact,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand wordmark */}
      <Image
        source={require('../../assets/ntuboa.png')}
        style={{ width: logoWidth, height: logoHeight }}
      />
      <Text style={styles.tagline}>Grow Your Wealth Together</Text>

      <Text style={[styles.title, compact && styles.titleCompact]}>Let's Get Started</Text>

      {/* Social Button Grouping container */}
      <View style={styles.buttonGroup}>
        <BaseButton
          title={socialBusy === 'google' ? 'Signing in...' : 'Continue with Google'}
          onPress={onPressGoogle}
          fullWidth
          variant='secondary'
          icon={<GoogleIcon width={24} height={24} />}
          disabled={!!socialBusy}
        />

        <BaseButton
          title={socialBusy === 'apple' ? 'Signing in...' : 'Continue with Apple'}
          onPress={onPressApple}
          fullWidth
          variant='secondary'
          icon={
            <Image
              source={require('../../assets/images/Apple.png')}
              style={styles.socialIcon}
            />
          }
          disabled={!!socialBusy}
        />
      </View>

      {socialError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{socialError}</Text>
        </View>
      ) : null}

      <View style={styles.orRow}>
        <View style={styles.orRule} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orRule} />
      </View>

      {/* Main Authentication Flow Grouping */}
      <View style={styles.buttonGroup}>
        <BaseButton
          title='Sign Up'
          onPress={onPressSignUp}
          fullWidth
        />

        <BaseButton
          title='Login'
          onPress={onPressLogin}
          fullWidth
          variant='outline'
        />
      </View>

      <TouchableOpacity
        onPress={() => router.push('/PrivacyPolicy')}
        hitSlop={12}
        style={styles.legal}
      >
        <Text style={styles.legalText}>Privacy Policy | Terms of Service</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCompact: {
    paddingVertical: 20,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gold,
    marginTop: 12,
    marginBottom: 20,
  },
  socialIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 20,
    marginBottom: 16,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginVertical: 16,
    gap: 12,
  },
  orRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceElevated,
  },
  orText: {
    fontSize: 12,
    color: colors.textMutedAlt,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  legal: {
    marginTop: 24,
  },
  legalText: {
    color: colors.textMutedAlt,
    fontSize: 12,
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
