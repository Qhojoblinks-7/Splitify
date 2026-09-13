import React, { useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import Checkbox from 'expo-checkbox';
import { Mail, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import CustomInput from '../../components/atoms/CustomInput';
import BaseButton from '../../components/atoms/BaseButton';

export default function CreateAccount() {
    const router = useRouter();
    const [agree, setAgree] = useState(false);

    const agreeToggle = () => {
        setAgree(!agree);
    };

    const onPressSignUp = () => {
        router.push('/screens/HomeScreen');
    };

    return (
        <View style={styles.Container}>

            {/* 1. Main Header and Form Area */}
            <View style={styles.top}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                    Please enter your email and password to sign up
                </Text>

                <View style={styles.inputWrapper}>
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
                        <Text style={styles.checkboxLabel}>I agree to Splitify Terms & Policies</Text>
                    </View>
                </View>
            </View>

            {/* 2. Spring Spacer - This pushes everything below it right to the footer */}
            <View style={styles.spacer} />

            {/* 3. Footer Section - Handles dividers, links, and action buttons together */}
            <View style={styles.footer}>
                
                {/* NEW: The crisp, thin divider line sitting under the form area */}
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
        alignItems: 'flex-start', 
    },
    inputWrapper: {
        width: '100%',
        marginTop: 10,
    },
    spacer: {
        flex: 1, 
    },
    dividerLine: {
        width: '100%',
        height: 1,                 // Sets thickness to exactly 1 structural pixel
        backgroundColor: '#2a2b30', // A subtle, sleek gray that pops gently off your dark background
        marginBottom: 20,          // Balanced spacing between the line and the Sign In text block
    },
    footer: {
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 30,
        lineHeight: 22,
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
        textAlign: "center" // FIXED: Corrected property name from alignText
    },
    signInLink: {
        color: '#fbb81c', 
        fontWeight: '600',
        fontSize: 15,
    }
});