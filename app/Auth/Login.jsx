import React, { useState } from 'react'; 
import { View, Text, Image, StyleSheet, Pressable } from 'react-native'; 
import { useRouter } from 'expo-router';
import Checkbox from 'expo-checkbox'; 
// 1. Import your desired icons from lucide-react-native
import { Mail, Lock } from 'lucide-react-native'; 
import BaseButton from '../../components/atoms/BaseButton';
import CustomInput from '../../components/atoms/CustomInput';

export default function Login() {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(false); 

  const onPressLogin = () => {
    router.replace("/(tabs)"); // Replace with your actual home screen route
  };

  const onPressForgotPassword = () => {
    // Handle forgot password logic here
    router.push("/Auth/ForgotPassword"); // Replace with your actual forgot password screen route
  };

  const rememberMeToggle = () => {
    setRememberMe(!rememberMe);
  };


  return (
    <View style={styles.Container}>
      
      {/* Upper main input fields */}
      <View style={styles.top}>
        <Image 
          source={require('../../assets/images/logo.png')} 
          style={styles.logoImage} 
        />

        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Please login to your account</Text>

        {/* 2. Pass the Mail icon into iconLeft */}
        <CustomInput 
        label='Email'
          keyboardType='email-address' 
          autoCapitalize='none' 
          placeholderTextColor='#797777'
          borderColor='#797777'
          iconLeft={<Mail color="#797777" size={20} />} 
          style={styles.input} 
        />

        {/* 3. Pass the Lock icon into iconLeft */}
        <CustomInput 
        label='Password'
          secureTextEntry 
          placeholderTextColor='#797777'
          iconLeft={<Lock color="#797777" size={20} />}
          style={styles.input} 
          borderColor='#797777'
        />

        <View style={styles.RememberMeContainer}>
          <View style={styles.checkboxContainer}>
            <Checkbox 
              value={rememberMe} 
              onValueChange={setRememberMe} 
              color={rememberMe ? '#fbb81c' : undefined} 
              style={styles.checkboxBorderFix} 
            />
            <Text style={styles.checkboxLabel}>Remember Me</Text>
          </View>
          
          <Pressable onPress={onPressForgotPassword}>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.spacer} />

      {/* Footer action section */}
      <View style={styles.footer}>
        <BaseButton 
          title='Login' 
          onPress={onPressLogin} 
          fullWidth 
          variant='primary' 
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
    Container: {
        flex: 1,
        backgroundColor: '#16171b', 
        paddingHorizontal: 20,
        paddingTop: 60,    
        paddingBottom: 24, 
    },
    top: {
        width: '100%',
        alignItems: 'center',
    },
    spacer: {
        flex: 1, 
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    logoImage: {
        width: 200,
        height: 100,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 30,
    },
    input: {
        width: '100%',
        marginBottom: 15,
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
        borderColor: '#fbb81c', 
        borderWidth: 0.5,
    },
    checkboxLabel: {
        marginLeft: 8,
        color: '#666666',
    },
    forgotPassword: {
        color: '#c2a989',
    }
});