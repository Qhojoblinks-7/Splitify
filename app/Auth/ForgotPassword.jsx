import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import CustomInput from '../../components/atoms/CustomInput';
import { Mail } from 'lucide-react-native';
import BaseButton from '../../components/atoms/BaseButton';

export default function ForgotPassword() {
    const router = useRouter();
    
    const onPressContinue = () => {
        router.push('/Auth/OTP');
    };

    return (
        <View style={styles.Container}>
            
            {/* 1. Top Section - Inputs and Headings nested cleanly together */}
            <View style={styles.top}>
                <Text style={styles.title}>Reset Your Password</Text>
                <Text style={styles.subtitle}>
                    Please enter your email and we will send you an OTP in the next step to reset your password.
                </Text>

                {/* Form wrapper */}
                <View style={styles.inputWrapper}>
                    <CustomInput
                        label='Email'
                        keyboardType='email-address'
                        autoCapitalize='none'
                        placeholderTextColor='#797777'
                        borderColor='#797777'
                        iconLeft={<Mail color='#797777' size={20}/>}
                    />
                </View>
            </View>

            {/* 2. Flex Spring - Pushes the footer button directly down */}
            <View style={styles.spacer} />

            {/* 3. Footer Section - Container matching your stylesheet structure */}
            <View style={styles.footer}>
                <BaseButton 
                    title='Continue'
                    onPress={onPressContinue}
                    variant='primary'
                    fullWidth
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
        alignItems: 'flex-start', // Shifted headings to the left edge for clean readability
    },
    inputWrapper: {
        width: '100%',
        marginTop: 10,
    },
    spacer: {
        flex: 1, 
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
});