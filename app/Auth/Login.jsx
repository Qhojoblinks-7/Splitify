import React, { useState } from 'react'; 
import { Text, StyleSheet, Pressable } from 'react-native'; 
import { useRouter } from 'expo-router';
import Checkbox from 'expo-checkbox'; 
import { Mail, Lock } from 'lucide-react-native'; 
import BaseButton from '../../components/atoms/BaseButton';
import CustomInput from '../../components/atoms/CustomInput';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';

export default function Login() {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(false); 

  const onPressLogin = () => {
    router.replace("/(tabs)");
  };

  const onPressForgotPassword = () => {
    router.push("/Auth/ForgotPassword");
  };

  const rememberMeToggle = () => {
    setRememberMe(!rememberMe);
  };

  return (
    <AuthScreenLayout
      brand="Growl"
      title="Welcome Back!"
      footer={<BaseButton title='Login' onPress={onPressLogin} fullWidth variant='primary' />}
    >
      <CustomInput 
        label='Email'
        keyboardType='email-address' 
        autoCapitalize='none' 
        placeholderTextColor='#797777'
        borderColor='#797777'
        iconLeft={<Mail color="#797777" size={20} />} 
        style={styles.input} 
      />

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
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
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