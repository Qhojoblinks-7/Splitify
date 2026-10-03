import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {useRouter} from 'expo-router'
import CustomInput from '../../components/atoms/CustomInput';
import BaseButton from '../../components/atoms/BaseButton';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';

export default function OTP() {
    const router = useRouter();

    const handleVerify = () => {
        router.push('/Auth/NewPassword')
    };

    return (
        <AuthScreenLayout
          title="OTP Code Verification"
          footer={<BaseButton title='Verify' onPress={handleVerify} variant='primary' fullWidth />}
        >
            <View style={styles.inputContainer}>
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
                <CustomInput
                    keyboardType='number-pad'
                    maxLength={1}
                    style={styles.otpBox}
                    textAlign="center"
                />
            </View>

            <View style={{marginTop: 30,}}>
                <Text style={styles.resend}>Didn't receive email?</Text>
                <Text style={styles.resend}>You can resend code in 55s</Text>
            </View>
        </AuthScreenLayout>
    );
}

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        justifyContent: 'space-between',
    },
    otpBox: {
        flex: 1,
        marginBottom: 0,
    },
    resend: {
        color: "#666666",
        textAlign: "center"
    }
});
