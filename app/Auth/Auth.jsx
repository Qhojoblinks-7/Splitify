import { useState } from 'react';
import { Text, View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import GoogleIcon from '../../assets/images/google.svg';
import BaseButton from '../../components/atoms/BaseButton';

export default function Auth() {
    const router = useRouter();

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
    router.push("/Auth/Login"); // Replace with the main app screen route
  };

  return (
    <View style={styles.container}>

      {/* Brand wordmark */}
      <Text style={styles.brand}>Growl</Text>
      <Text style={styles.tagline}>Grow Your Wealth Together</Text>

      <Text style={styles.title}>Let's Get Started</Text>

      {/* Social Button Grouping container */}
      <View style={styles.buttonGroup}>
        <BaseButton 
          title='Continue with Google' 
          onPress={onPressGoogle} 
          fullWidth 
          variant='secondary'
          icon={
            <GoogleIcon width={24} height={24} /> // Using the imported SVG as a React component
          } 
        />

        <BaseButton 
          title='Continue with Apple' 
          onPress={onPressApple} 
          fullWidth 
          variant='secondary' 
          icon={
            <Image 
        source={require('../../assets/images/Apple.png')} // Replace with your actual local project asset path
        style={styles.socialIcon}
      />
          } 
        />
      </View>

      <Text style={styles.orText}>or</Text>

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

      <View style={{  }} />
      <TouchableOpacity onPress={() => router.push("/PrivacyPolicy")}>
        <Text style={{ color: '#666666', fontSize: 12, marginTop: 50 }}>
          Privacy Policy | Terms of Service
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16171b', // Sleek Growl dark canvas background
  },
  logoImage: {
    width: 200,
    height: 100,
    borderRadius: 20,
    marginBottom: 32,
  },
  brand: {
    fontSize: 40,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fbb81c',
    marginBottom: 28,
  },
  socialIcon: {
    width: 50,
    height: 50,
    resizeMode: 'contain', // Safeguards the vector asset ratio from stretching
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff', // High-contrast white text header
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    gap: 14, // Built-in flex gaps separate buttons beautifully without repetitive margins
  },
  orText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
    marginVertical: 20,
    textTransform: 'uppercase', // Gives 'OR' a clean structural layout profile
  },
  
});