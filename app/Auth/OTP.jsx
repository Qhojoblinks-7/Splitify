import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {useRouter} from 'expo-router'
import CustomInput from '../../components/atoms/CustomInput';
import BaseButton from '../../components/atoms/BaseButton';

export default function OTP() {
    const router = useRouter();

    const handleVerify = () => {
        // Handle code submission logic here
        router.push('/Auth/NewPassword')
    };

    return (
        <View style={styles.Container}>
            
            {/* Top Main Section */}
            <View style={styles.top}>
                <Text style={styles.title}>OTP Code Verification</Text>
                <Text style={styles.subtitle}>
                    We have sent an OTP code to your email and*******lay@gmail.com. Enter the OTP code to verify.
                </Text>

                {/* The 4-digit layout block */}
                <View style={styles.inputContainer}>
                    {/* FIXED: Corrected spelling to keyboardType and added styling overrides */}
                    <CustomInput
                        keyboardType='number-pad'
                        maxLength={1} // Limits input to one single number per box
                        style={styles.otpBox}
                        textAlign="center" // Centers the number inside the box
                    />
                    <CustomInput
                        keyboardType='number-pad'
                        maxLength={1}
                        style={styles.otpBox}
                        textAlign="center"
                    />
                    <CustomInput
                        keyboardType='number-pad'
                        maxLength={1}
                        style={styles.otpBox}
                        textAlign="center"
                    />
                    <CustomInput
                        keyboardType='number-pad'
                        maxLength={1}
                        style={styles.otpBox}
                        textAlign="center"
                    />
                </View>
            </View>

            <View style={{marginTop: 30,}}>
                <Text style={styles.resend}>Didn't receive email?</Text>
                <Text style={styles.resend}>You can resend code in 55s</Text>
            </View>

            {/* Layout Spring */}
            <View style={styles.spacer} />

            {/* Footer Action Button */}
            <View style={styles.footer}>
                <BaseButton 
                    title='Verify'
                    onPress={handleVerify}
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
    inputContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12, // Automatically calculates perfect spaces between the boxes
        justifyContent: 'space-between',
    },
    otpBox: {
        flex: 1, // Dynamically resizes each input window to share screen space perfectly
        marginBottom: 0, // Erases the atom component's default bottom margin
    },
    resend: {
        color: "#666666",
        textAlign: "center"
    }
});