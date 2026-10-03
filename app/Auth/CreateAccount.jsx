import React, { useState } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Checkbox from 'expo-checkbox';
import { Mail, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import CustomInput from '../../components/atoms/CustomInput';
import BaseButton from '../../components/atoms/BaseButton';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';

export default function CreateAccount() {
    const router = useRouter();
    const [agree, setAgree] = useState(false);

    const agreeToggle = () => {
        setAgree(!agree);
    };

    const onPressSignUp = () => {
        router.push('/(tabs)');
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
                title="Sign Up"
                variant='primary'
                fullWidth
                onPress={onPressSignUp}
              />
            </>
          }
        >
            <CustomInput
                label="Email"
                borderColor="#797777"
                keyboardType="email-address"
                iconLeft={<Mail size={20} color='#666666' />}
            />
            
            <CustomInput
                label="Password"
                borderColor="#797777"
                secureTextEntry
                iconLeft={<Lock size={20} color='#666666' />}
            />
            
            <CustomInput
                label="Confirm Password"
                borderColor="#797777"
                secureTextEntry
                iconLeft={<Lock size={20} color='#666666' />}
            />

            <View style={styles.checkboxContainer}>
                <Checkbox 
                    value={agree} 
                    onValueChange={setAgree} 
                    color={agree ? '#fbb81c' : undefined} 
                    style={styles.checkboxBorderFix} 
                />
                <Text style={styles.checkboxLabel}>I agree to Growl Terms & Policies</Text>
            </View>
        </AuthScreenLayout>
    );
}

const styles = StyleSheet.create({
    dividerLine: {
        width: '100%',
        height: 1,
        backgroundColor: '#2a2b30',
        marginBottom: 20,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    checkboxBorderFix: {
        borderColor: '#fbb81c', 
        borderWidth: 0.5,
    },
    checkboxLabel: {
        marginLeft: 8,
        color: '#666666',
        fontSize: 14,
    },
    signInContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20, 
    },
    signInText: {
        color: '#666666',
        fontSize: 15,
        textAlign: "center"
    },
    signInLink: {
        color: '#fbb81c', 
        fontWeight: '600',
        fontSize: 15,
    }
});