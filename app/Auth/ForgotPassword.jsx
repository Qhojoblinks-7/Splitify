import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import CustomInput from '../../components/atoms/CustomInput';
import { Mail } from 'lucide-react-native';
import BaseButton from '../../components/atoms/BaseButton';
import AuthScreenLayout from '../../components/molecule/AuthScreenLayout';

export default function ForgotPassword() {
    const router = useRouter();
    
    const onPressContinue = () => {
        router.push('/Auth/OTP');
    };

    return (
        <AuthScreenLayout
          title="Reset Your Password"
          footer={<BaseButton title='Continue' onPress={onPressContinue} variant='primary' fullWidth />}
        >
            <CustomInput
                label='Email'
                keyboardType='email-address'
                autoCapitalize='none'
                placeholderTextColor='#797777'
                borderColor='#797777'
                iconLeft={<Mail color='#797777' size={20}/>}
            />
        </AuthScreenLayout>
    );
}
