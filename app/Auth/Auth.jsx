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
import GoogleIcon from '../../assets/images/google.svg';
import BaseButton from '../../components/atoms/BaseButton';

const LOGO_HEIGHT = 52;
const MAX_LOGO_WIDTH = 180;

export default function Auth() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // The logo is the only element that has to give way. Scaling it to the viewport keeps the
  // wordmark from dominating a small screen while still filling a large one, and the clamp
  // stops it stretching past the width of the buttons below it.
  const logoWidth = Math.min(width * 0.46, MAX_LOGO_WIDTH);
  const logoHeight = logoWidth * (LOGO_HEIGHT / MAX_LOGO_WIDTH);
  const compact = height < 700;

  const onPressGoogle = () => {
    // Handle Google Sign-In logic here
  };

  const onPressApple = () => {
    // Handle Apple Sign-In logic here
  };

  const onPressSignUp = () => {
    // Navigate to Sign Up screen or handle sign up logic
    router.push('/Auth/CreateAccount');
  };

  const onPressLogin = () => {
    // Navigate to Login screen or handle login logic
    router.push('/Auth/Login'); // Replace with the main app screen route
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
          title='Continue with Google'
          onPress={onPressGoogle}
          fullWidth
          variant='secondary'
          icon={<GoogleIcon width={24} height={24} />}
        />

        <BaseButton
          title='Continue with Apple'
          onPress={onPressApple}
          fullWidth
          variant='secondary'
          icon={
            <Image
              source={require('../../assets/images/Apple.png')}
              style={styles.socialIcon}
            />
          }
        />
      </View>

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
    backgroundColor: '#16171b', // Sleek Growl dark canvas background
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
    color: '#fbb81c',
    marginTop: 12,
    marginBottom: 20,
  },
socialIcon: {
    width: 50,
    height: 50,
    resizeMode: 'contain', // Safeguards the vector asset ratio from stretching
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff', // High-contrast white text header
    marginBottom: 20,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 20,
    marginBottom: 16,
  },
  buttonGroup: {
    width: '100%',
    gap: 10, // Built-in flex gaps separate buttons without repetitive margins
  },
  // Rules either side of "or" instead of vertical space, so the divider reads as a divider
  // and stops the gap from growing on a tall screen.
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
    backgroundColor: '#3a3b40',
  },
  orText: {
    fontSize: 12,
    color: '#8a8b90',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  // Fixed margin keeps the legal text centered with the rest of the content
  // instead of pushing it to the bottom of the screen.
  legal: {
    marginTop: 24,
  },
  legalText: {
    color: '#8a8b90',
    fontSize: 12,
  },
});